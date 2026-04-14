import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Claude Haiku 4.5 list price (per 1M tokens):
//   input       $1.00   →  100¢ / 1M tokens
//   output      $5.00   →  500¢ / 1M tokens
//   cache read  ~0.1x   →   10¢ / 1M tokens
//   cache write 1.25x   →  125¢ / 1M tokens (5-minute TTL, the default)
// OpenAI Whisper-1 list price: $0.006 / minute of audio → 0.6¢ / minute.
const CENTS_PER_INPUT_TOKEN = 100 / 1_000_000;
const CENTS_PER_OUTPUT_TOKEN = 500 / 1_000_000;
const CENTS_PER_CACHE_READ_TOKEN = 10 / 1_000_000;
const CENTS_PER_CACHE_WRITE_TOKEN = 125 / 1_000_000;
const WHISPER_CENTS_PER_MINUTE = 0.6;

export interface ClassificationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export function estimateClaudeCostCents(usage: ClassificationUsage): number {
  return (
    usage.inputTokens * CENTS_PER_INPUT_TOKEN +
    usage.outputTokens * CENTS_PER_OUTPUT_TOKEN +
    usage.cacheReadInputTokens * CENTS_PER_CACHE_READ_TOKEN +
    usage.cacheCreationInputTokens * CENTS_PER_CACHE_WRITE_TOKEN
  );
}

export function estimateWhisperCostCents(audioSeconds: number): number {
  return (audioSeconds / 60) * WHISPER_CENTS_PER_MINUTE;
}

/**
 * Very rough audio-duration estimate from byte length. Assumes ~64 kbps m4a
 * (≈8 KB/sec). Good enough for order-of-magnitude cost logging; WS3 should
 * pass real duration in object metadata once the mobile recorder is in.
 */
export function estimateAudioSeconds(audioByteLength: number): number {
  const BYTES_PER_SECOND = 8000;
  return audioByteLength / BYTES_PER_SECOND;
}

/**
 * Append a per-recording cost row under costs/{userId}/{yyyy-mm}/{recordingId}.
 * WS4 plugs an aggregation function on top of this to drive dashboards and
 * alerts; for now it's the raw event stream.
 */
export async function logRecordingCost(params: {
  userId: string;
  recordingId: string;
  audioByteLength: number;
  classificationUsage: ClassificationUsage;
  elapsedMs: number;
  overBudget: boolean;
}): Promise<void> {
  const firestore = getFirestore();
  const month = new Date().toISOString().slice(0, 7); // yyyy-mm
  const audioSeconds = estimateAudioSeconds(params.audioByteLength);
  const whisperCents = estimateWhisperCostCents(audioSeconds);
  const claudeCents = estimateClaudeCostCents(params.classificationUsage);

  await firestore
    .collection('costs')
    .doc(params.userId)
    .collection(month)
    .doc(params.recordingId)
    .set({
      audioSeconds,
      audioByteLength: params.audioByteLength,
      whisperCents,
      claudeCents,
      totalCents: whisperCents + claudeCents,
      classificationUsage: params.classificationUsage,
      elapsedMs,
      overBudget: params.overBudget,
      timestamp: FieldValue.serverTimestamp(),
    });
}
