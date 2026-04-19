import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import type { ClassificationContext, EntityType } from './types';

// Caps chosen to stay well inside Claude Haiku 4.5's input budget while still
// giving the model enough signal to assign topics correctly. Raise these only
// after measuring the resulting prompt size and cache hit rate.
const MAX_TOPICS = 40;
const MAX_RECENT_ITEMS = 30;

/**
 * Fetch the per-user context Claude needs to do cross-recording clustering:
 *
 *   - existingTopics: lets Claude prefer topicMatch over inventing new topics
 *   - knownEntities:  lets Claude resolve "my daughter" to a named person
 *   - recentItemTitles: gives the model a sense of the user's world without
 *                       blowing the context budget
 *
 * All three queries run in parallel. If any one fails, it degrades to an
 * empty value — we never want a context fetch error to block classification
 * (the user would see "nothing captured" for reasons unrelated to their audio).
 */
export async function fetchClassificationContext(
  userId: string,
): Promise<ClassificationContext> {
  const firestore = getFirestore();

  const [topicsResult, userResult, itemsResult] = await Promise.allSettled([
    firestore
      .collection('topics')
      .where('userId', '==', userId)
      .orderBy('lastUpdatedAt', 'desc')
      .limit(MAX_TOPICS)
      .get(),
    firestore.collection('users').doc(userId).get(),
    firestore
      .collection('items')
      .where('userId', '==', userId)
      .where('completedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .limit(MAX_RECENT_ITEMS)
      .get(),
  ]);

  const existingTopics =
    topicsResult.status === 'fulfilled'
      ? topicsResult.value.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            itemCount?: number;
          };
          return {
            id: d.id,
            name: data.name ?? '',
            itemCount: data.itemCount ?? 0,
          };
        })
      : [];

  const knownEntities: ClassificationContext['knownEntities'] = {};
  if (userResult.status === 'fulfilled' && userResult.value.exists) {
    const data = userResult.value.data() as {
      entities?: Record<
        string,
        { type?: EntityType; relationship?: string }
      >;
    };
    for (const [name, entity] of Object.entries(data.entities ?? {})) {
      if (!entity?.type) continue;
      knownEntities[name] = {
        type: entity.type,
        relationship: entity.relationship,
      };
    }
  }

  const recentItemTitles =
    itemsResult.status === 'fulfilled'
      ? itemsResult.value.docs.map((d) => {
          const data = d.data() as { title?: string; category?: string };
          return {
            title: data.title ?? '',
            category: data.category ?? '',
          };
        })
      : [];

  // Log any partial failures so we can see them in WS4 dashboards without
  // blocking the user flow.
  for (const [label, result] of [
    ['topics', topicsResult],
    ['user', userResult],
    ['items', itemsResult],
  ] as const) {
    if (result.status === 'rejected') {
      logger.warn('context fetch partial failure', {
        userId,
        label,
        error: (result.reason as Error)?.message ?? String(result.reason),
      });
    }
  }

  return { existingTopics, knownEntities, recentItemTitles };
}
