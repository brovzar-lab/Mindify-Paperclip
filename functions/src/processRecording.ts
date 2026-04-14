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

// Storage objects land at audio/{userId}/{recordingId}.{ext}. The extension
// is captured but discarded so the recordingId stays clean for use as a
// Firestore doc id; the original filename (with extension) is reconstructed
// when calling Whisper so its MIME detection still works.
const AUDIO_PATH_PATTERN = /^audio\/([^/]+)\/([^/]+)\.(m4a|mp3|wav|webm|ogg)$/;

/**
 * Storage-triggered pipeline:
 *   Storage upload → rate-limit gate → Whisper transcription →
 *   Claude classification → smart grouping → atomic Firestore write
 *   (recording, items, groups) → cost log.
 *
 * The final Firestore write is a single batch so the client's real-time
 * listener sees all items (and their group assignments) appear together.
 */
export const processRecording = onObjectFinalized(
  {
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

    // 2. Transcribe via Whisper.
    const transcript = await transcribeAudio(audioBytes, objectName);
    logger.info('Transcribed', {
      recordingId,
      length: transcript.length,
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

    // 3. Classify via Claude.
    const { items, usage } = await classifyTranscript(transcript);
    logger.info('Classified', {
      recordingId,
      itemCount: items.length,
      usage,
    });

    // 4. Propose groups within this recording's items.
    const groups = proposeGroups(items);

    // 5. Single atomic batch: create group docs first (so we know their
    //    ids), then item docs with their groupId stamped, then mark the
    //    recording processed.
    const batch = firestore.batch();
    const itemRefs = items.map(() =>
      firestore.collection('items').doc(),
    );
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

    items.forEach((item, i) => {
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
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
      });
    });

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
