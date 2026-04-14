import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Per-user hourly cap on recordings that make it to the expensive pipeline
// (Whisper + Claude). A rolling one-hour window is simpler and cheaper than
// a sliding-window counter; it can over-count by at most one hour's worth
// at a boundary, which is fine for cost control at MVP scale.
export const MAX_RECORDINGS_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

export interface RateLimitDecision {
  allowed: boolean;
  currentCount: number;
  resetAtMs: number;
}

/**
 * Atomically check and increment the rate-limit counter for a user.
 *
 * If within the cap, increments and returns `allowed: true`. If at/over the
 * cap, returns `allowed: false` without incrementing. Counter window resets
 * when the stored `hourStartMs` is older than HOUR_MS.
 *
 * Callers should short-circuit the pipeline on `allowed: false` and (for
 * auditability) mark the recording doc with the rate-limit reason.
 */
export async function checkAndIncrement(userId: string): Promise<RateLimitDecision> {
  const firestore = getFirestore();
  const ref = firestore.collection('rateLimit').doc(userId);
  const now = Date.now();

  return firestore.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() as { hourStartMs?: number; count?: number } | undefined;

    let hourStartMs: number;
    let count: number;

    if (!data || typeof data.hourStartMs !== 'number' || now - data.hourStartMs >= HOUR_MS) {
      hourStartMs = now;
      count = 0;
    } else {
      hourStartMs = data.hourStartMs;
      count = data.count ?? 0;
    }

    if (count >= MAX_RECORDINGS_PER_HOUR) {
      return {
        allowed: false,
        currentCount: count,
        resetAtMs: hourStartMs + HOUR_MS,
      };
    }

    tx.set(
      ref,
      {
        hourStartMs,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      allowed: true,
      currentCount: count + 1,
      resetAtMs: hourStartMs + HOUR_MS,
    };
  });
}
