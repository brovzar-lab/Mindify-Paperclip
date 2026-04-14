/**
 * WS4 classification test runner.
 *
 * Runs every fixture in ./fixtures.ts through the real Claude API and
 * reports per-fixture match rate + aggregate cache-hit ratio + aggregate
 * cost. Does NOT fail on mismatches — this is a diagnostic, not a gate.
 * CI can adopt it as a gate once we have confidence in target numbers.
 *
 * Usage (from functions/):
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx test/runClassification.ts
 */
import { classifyTranscript } from '../src/claude';
import { estimateClaudeCostCents } from '../src/metrics';
import { FIXTURES, type ClassificationFixture, type ExpectedItem } from './fixtures';
import type { ClassifiedItem } from '../src/types';

// The real Cloud Function pulls secrets from Firebase Secret Manager via
// defineSecret(). This runner is for local dev, so it reads from the env
// directly and monkey-patches the defineSecret shim so imports don't throw.
process.env.ANTHROPIC_API_KEY ??= '';
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is required. Export it before running the harness.',
  );
  process.exit(1);
}
// config.ts reads the secret via ANTHROPIC_API_KEY.value(). defineSecret()
// returns something with .value(); in dev mode without the functions
// emulator it reads from process.env automatically.

interface FieldMatch {
  type: boolean;
  category: boolean;
  urgency: boolean;
  bucket: boolean;
  title: boolean;
}

function matchItem(expected: ExpectedItem, actual: ClassifiedItem): FieldMatch {
  return {
    type: expected.type === actual.type,
    category: expected.category === actual.category,
    urgency: expected.urgency === actual.urgency,
    bucket: expected.bucket === actual.bucket,
    title: actual.title.toLowerCase().includes(expected.titleIncludes.toLowerCase()),
  };
}

function scoreFixture(fixture: ClassificationFixture, actual: ClassifiedItem[]): {
  countMatch: boolean;
  itemMatches: FieldMatch[];
  perFieldAccuracy: Record<keyof FieldMatch, number>;
} {
  const countMatch = fixture.expected.length === actual.length;
  const itemMatches: FieldMatch[] = [];

  // Greedy alignment by expected order. Good enough for the fixture set;
  // swap to Hungarian matching if false-positives from ordering start
  // dominating the noise.
  for (let i = 0; i < Math.min(fixture.expected.length, actual.length); i++) {
    itemMatches.push(matchItem(fixture.expected[i], actual[i]));
  }

  const accumulate = (key: keyof FieldMatch) =>
    itemMatches.length === 0
      ? 1 // vacuously correct when both expected and actual are empty
      : itemMatches.filter((m) => m[key]).length / itemMatches.length;

  return {
    countMatch,
    itemMatches,
    perFieldAccuracy: {
      type: accumulate('type'),
      category: accumulate('category'),
      urgency: accumulate('urgency'),
      bucket: accumulate('bucket'),
      title: accumulate('title'),
    },
  };
}

async function main() {
  console.log(`Running ${FIXTURES.length} classification fixtures...\n`);

  const fieldAccuracies: Record<keyof FieldMatch, number[]> = {
    type: [],
    category: [],
    urgency: [],
    bucket: [],
    title: [],
  };
  let countMatches = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCostCents = 0;
  let totalElapsedMs = 0;

  for (const fixture of FIXTURES) {
    const startedAt = Date.now();
    const result = await classifyTranscript(fixture.transcript);
    const elapsedMs = Date.now() - startedAt;
    totalElapsedMs += elapsedMs;

    const score = scoreFixture(fixture, result.items);

    if (score.countMatch) countMatches++;
    for (const key of Object.keys(fieldAccuracies) as (keyof FieldMatch)[]) {
      fieldAccuracies[key].push(score.perFieldAccuracy[key]);
    }

    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;
    totalCacheReadTokens += result.usage.cacheReadInputTokens;
    totalCacheWriteTokens += result.usage.cacheCreationInputTokens;
    totalCostCents += estimateClaudeCostCents(result.usage);

    const countIcon = score.countMatch ? '✓' : '✗';
    console.log(
      `[${fixture.id}] ${countIcon} expected=${fixture.expected.length} actual=${result.items.length}  elapsed=${elapsedMs}ms  cacheRead=${result.usage.cacheReadInputTokens}`,
    );
    if (!score.countMatch || Object.values(score.perFieldAccuracy).some((v) => v < 1)) {
      for (let i = 0; i < score.itemMatches.length; i++) {
        const m = score.itemMatches[i];
        const e = fixture.expected[i];
        const a = result.items[i];
        const flags = [
          m.type ? '' : `type(${a.type}≠${e.type})`,
          m.category ? '' : `cat(${a.category}≠${e.category})`,
          m.urgency ? '' : `urg(${a.urgency}≠${e.urgency})`,
          m.bucket ? '' : `buck(${a.bucket}≠${e.bucket})`,
          m.title ? '' : `title("${a.title}"!~"${e.titleIncludes}")`,
        ].filter(Boolean).join(' ');
        if (flags) console.log(`    #${i}: ${flags}`);
      }
    }
  }

  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  const cacheReadShare =
    totalCacheReadTokens / (totalCacheReadTokens + totalCacheWriteTokens + totalInputTokens || 1);

  console.log('\n=== Aggregate ===');
  console.log(`Fixtures:               ${FIXTURES.length}`);
  console.log(`Item-count matches:     ${countMatches}/${FIXTURES.length}`);
  console.log(`Type accuracy:          ${(mean(fieldAccuracies.type) * 100).toFixed(1)}%`);
  console.log(`Category accuracy:      ${(mean(fieldAccuracies.category) * 100).toFixed(1)}%`);
  console.log(`Urgency accuracy:       ${(mean(fieldAccuracies.urgency) * 100).toFixed(1)}%`);
  console.log(`Bucket accuracy:        ${(mean(fieldAccuracies.bucket) * 100).toFixed(1)}%`);
  console.log(`Title-contains hit:     ${(mean(fieldAccuracies.title) * 100).toFixed(1)}%`);
  console.log(`Input tokens:           ${totalInputTokens}`);
  console.log(`Output tokens:          ${totalOutputTokens}`);
  console.log(`Cache-read tokens:      ${totalCacheReadTokens}`);
  console.log(`Cache-write tokens:     ${totalCacheWriteTokens}`);
  console.log(`Cache-read share:       ${(cacheReadShare * 100).toFixed(1)}%`);
  console.log(`Total cost:             ${totalCostCents.toFixed(3)}¢`);
  console.log(`Total elapsed:          ${totalElapsedMs}ms (Claude only; no Whisper/Firestore)`);

  if (totalCacheReadTokens === 0) {
    console.log(
      '\nWARN: cache_read_input_tokens stayed at 0 across every request.',
    );
    console.log(
      '  Likely cause: system prompt is under Haiku 4.5 minimum cacheable prefix (4096 tokens).',
    );
    console.log('  Fix: expand src/prompts/classification.ts until we clear the floor.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
