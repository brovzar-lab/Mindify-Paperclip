import { onObjectFinalized, StorageEvent } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  LATENCY_BUDGET_MS,
} from './config';
import { transcribeAudio } from './whisper';
import { classifyTranscript } from './claude';
import { proposeGroups } from './grouping';
import { checkAndIncrement, MAX_RECORDINGS_PER_HOUR } from './rateLimiter';
import { logRecordingCost } from './metrics';
import { fetchClassificationContext } from './context';

// Storage objects land at audio/{userId}/{recordingId}.{ext}. The extension
// is captured but discarded so the recordingId stays clean for use as a
// Firestore doc id; the original filename (with extension) is reconstructed
// when calling Whisper so its MIME detection still works.
const AUDIO_PATH_PATTERN = /^audio\/([^/]+)\/([^/]+)\.(m4a|mp3|wav|webm|ogg)$/;

/**
 * Storage-triggered pipeline:
 *   Storage upload → rate-limit gate → Whisper transcription →
 *   context fetch (topics/entities/recent) → Claude classification →
 *   smart grouping → atomic Firestore write (recording, items, groups,
 *   topic updates, topicSuggestions, entitySuggestions) → cost log.
 *
 * The final Firestore write is a single batch so the client's real-time
 * listener sees all items (and their group/topic assignments) appear together.
 */
export const processRecording = onObjectFinalized(
  {
    // Must match the Storage bucket's region — Gen2 functions can only
    // listen to buckets in the same region.
    region: 'us-west1',
    secrets: [OPENAI_API_KEY, ANTHROPIC_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 60,
    // minInstances stays at 0 for MVP cost reasons. WS4 benchmarks against
    // the 8s latency budget — if cold starts blow the budget, bump to 1.
    concurrency: 1,
  },
  async (event: StorageEvent) => {
    const startedAt = Date.now();
    const objectName = event.data.name;
    if (!objectName) return;

    const match = AUDIO_PATH_PATTERN.exec(objectName);
    if (!match) {
      logger.debug('Ignoring non-audio object', { objectName });
      return;
    }

    const [, userId, recordingId] = match;
    logger.info('Processing recording', { userId, recordingId, objectName });

    const firestore = getFirestore();
    const recordingRef = firestore.collection('recordings').doc(recordingId);

    // 0. Rate-limit gate. If the user has hammered the pipeline, persist an
    //    audit trail on the recording and short-circuit before spending
    //    Whisper/Claude tokens.
    const decision = await checkAndIncrement(userId);
    if (!decision.allowed) {
      logger.warn('Rate limit exceeded', { userId, recordingId, decision });
      await recordingRef.set(
        {
          userId,
          audioUrl: `gs://${event.data.bucket}/${objectName}`,
          rateLimited: true,
          rateLimitResetAt: new Date(decision.resetAtMs).toISOString(),
          rateLimitCap: MAX_RECORDINGS_PER_HOUR,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    // 1. Download the audio bytes from Storage.
    const bucket = getStorage().bucket(event.data.bucket);
    const [audioBytes] = await bucket.file(objectName).download();

    // 2. Transcribe via Whisper and (in parallel) fetch per-user context.
    //    Context is safe to fetch before classification — it only reads
    //    collections the user owns and doesn't depend on the transcript.
    const [transcript, context] = await Promise.all([
      transcribeAudio(audioBytes, objectName),
      fetchClassificationContext(userId),
    ]);
    logger.info('Transcribed', {
      recordingId,
      length: transcript.length,
      topicCount: context.existingTopics.length,
      entityCount: Object.keys(context.knownEntities).length,
    });

    // Persist the transcript + recording metadata immediately so the client
    // can show "we heard you" feedback while classification runs.
    await recordingRef.set(
      {
        userId,
        audioUrl: `gs://${event.data.bucket}/${objectName}`,
        transcript,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (!transcript) {
      logger.warn('Empty transcript; skipping classification', { recordingId });
      await recordingRef.update({
        processedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    // 3. Classify via Claude with per-user context.
    const { items, entityProposals, usage } = await classifyTranscript(
      transcript,
      context,
    );
    logger.info('Classified', {
      recordingId,
      itemCount: items.length,
      entityProposalCount: entityProposals.length,
      usage,
    });

    // 4. Propose groups within this recording's items (intra-recording
    //    clustering still runs alongside cross-recording topics).
    const groups = proposeGroups(items);

    // Validate that every topicMatch the model returned actually points at
    // a known topic id. Anything else is treated as a proposal for the
    // user's preferred topic-creation flow.
    const validTopicIds = new Set(context.existingTopics.map((t) => t.id));

    // 5. Single atomic batch: create group docs first (so we know their
    //    ids), then item docs with groupId + topicId stamped, then
    //    topic-membership updates, topic suggestions, entity suggestions,
    //    and finally mark the recording processed.
    const batch = firestore.batch();
    const itemRefs = items.map(() => firestore.collection('items').doc());
    const itemGroupId = new Map<number, string>();

    for (const group of groups) {
      const groupRef = firestore.collection('groups').doc();
      batch.set(groupRef, {
        userId,
        title: group.title,
        category: group.category,
        itemIds: group.itemIndices.map((i) => itemRefs[i].id),
        createdAt: FieldValue.serverTimestamp(),
      });
      for (const i of group.itemIndices) {
        itemGroupId.set(i, groupRef.id);
      }
    }

    // Aggregate item ids per topic for a single arrayUnion update per topic.
    const topicAdditions = new Map<string, string[]>();
    // Aggregate proposal by name so multiple items proposing the same topic
    // share one TopicSuggestionDoc.
    const topicProposalsByName = new Map<string, string[]>();

    items.forEach((item, i) => {
      const itemId = itemRefs[i].id;
      let topicId: string | null = null;

      if (item.topicMatch && validTopicIds.has(item.topicMatch)) {
        topicId = item.topicMatch;
        const bucket = topicAdditions.get(topicId) ?? [];
        bucket.push(itemId);
        topicAdditions.set(topicId, bucket);
      } else if (item.topicProposal) {
        const trimmed = item.topicProposal.trim();
        if (trimmed) {
          const bucket = topicProposalsByName.get(trimmed) ?? [];
          bucket.push(itemId);
          topicProposalsByName.set(trimmed, bucket);
        }
      }

      batch.set(itemRefs[i], {
        userId,
        recordingId,
        type: item.type,
        title: item.title,
        body: item.body ?? null,
        category: item.category,
        categoryColor: item.categoryColor,
        energyLevel: item.energyLevel,
        urgency: item.urgency,
        bucket: item.bucket,
        groupId: itemGroupId.get(i) ?? null,
        topicId,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
      });
    });

    // Update each matched topic doc: append the new item ids and bump the
    // counter / lastUpdatedAt so Topics sorts by recency.
    for (const [topicId, newItemIds] of topicAdditions.entries()) {
      const topicRef = firestore.collection('topics').doc(topicId);
      batch.update(topicRef, {
        itemIds: FieldValue.arrayUnion(...newItemIds),
        itemCount: FieldValue.increment(newItemIds.length),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Write topic suggestions (one per unique proposed name). User must
    // approve before a TopicDoc gets created.
    for (const [name, proposedItemIds] of topicProposalsByName.entries()) {
      const suggestionRef = firestore.collection('topicSuggestions').doc();
      batch.set(suggestionRef, {
        userId,
        name,
        proposedItemIds,
        sourceRecordingId: recordingId,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Write entity suggestions. The client will surface these via local
    // notification and the EntityConfirmationModal.
    const knownEntityNames = new Set(Object.keys(context.knownEntities));
    for (const proposal of entityProposals) {
      const name = proposal.name?.trim();
      if (!name) continue;
      if (knownEntityNames.has(name)) continue; // already confirmed
      const suggestionRef = firestore.collection('entitySuggestions').doc();
      batch.set(suggestionRef, {
        userId,
        name,
        type: proposal.type,
        relationship: proposal.relationship ?? null,
        sourceRecordingId: recordingId,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    batch.update(recordingRef, {
      processedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    const elapsedMs = Date.now() - startedAt;
    const overBudget = elapsedMs > LATENCY_BUDGET_MS;
    logger.info('Recording processed', {
      recordingId,
      elapsedMs,
      budgetMs: LATENCY_BUDGET_MS,
      overBudget,
      itemCount: items.length,
      groupCount: groups.length,
      topicMatchCount: topicAdditions.size,
      topicProposalCount: topicProposalsByName.size,
      entitySuggestionCount: entityProposals.length,
    });

    // 6. Log per-recording cost to Firestore. Non-fatal if it fails —
    //    don't want metrics to break the user flow.
    try {
      await logRecordingCost({
        userId,
        recordingId,
        audioByteLength: audioBytes.length,
        classificationUsage: usage,
        elapsedMs,
        overBudget,
      });
    } catch (err) {
      logger.error('Failed to log recording cost', {
        recordingId,
        error: (err as Error).message,
      });
    }
  },
);
