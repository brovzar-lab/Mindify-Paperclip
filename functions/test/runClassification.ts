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
import Anthropic from '@anthropic-ai/sdk';
import { classifyTranscript } from '../src/claude';
import { estimateClaudeCostCents } from '../src/metrics';
import { FIXTURES, type ClassificationFixture, type ExpectedItem } from './fixtures';
import type { ClassifiedItem } from '../src/types';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    'ANTHROPIC_API_KEY is required. Export it before running the harness.',
  );
  process.exit(1);
}
// Build our own client and thread it into classifyTranscript so we never
// go through defineSecret() in a non-Firebase context.
const anthropic = new Anthropic({ apiKey });

interface FieldMatch {
  type: boolean;
  category: boolean;
  urgency: boolean;
  bucket: boolean;
  title: boolean;
}

const MATCH_FIELDS: readonly (keyof FieldMatch)[] = [
  'type',
  'category',
  'urgency',
  'bucket',
  'title',
] as const;

function matchItem(expected: ExpectedItem, actual: ClassifiedItem): FieldMatch {
  return {
    type: expected.type === actual.type,
    category: expected.category === actual.category,
    urgency: expected.urgency === actual.urgency,
    bucket: expected.bucket === actual.bucket,
    title: actual.title.toLowerCase().includes(expected.titleIncludes.toLowerCase()),
  };
}

function matchScore(m: FieldMatch): number {
  return MATCH_FIELDS.filter((k) => m[k]).length;
}

/**
 * Optimal bipartite matching: for each permutation of actuals, score
 * against expected. Keep the permutation that maximises total match
 * score. Exhaustive — fine up to ~8 items per fixture (8! = 40320);
 * above that, fall back to greedy best-match.
 */
function bestAlignment(
  expected: ExpectedItem[],
  actual: ClassifiedItem[],
): FieldMatch[] {
  const pairCount = Math.min(expected.length, actual.length);
  if (pairCount === 0) return [];

  if (actual.length <= 8) {
    let best: FieldMatch[] = [];
    let bestScore = -1;
    const indices = actual.map((_, i) => i);

    const tryPerm = (perm: number[]) => {
      const matches: FieldMatch[] = [];
      let score = 0;
      for (let i = 0; i < pairCount; i++) {
        const m = matchItem(expected[i], actual[perm[i]]);
        matches.push(m);
        score += matchScore(m);
      }
      if (score > bestScore) {
        bestScore = score;
        best = matches;
      }
    };

    const permute = (arr: number[], k: number) => {
      if (k === arr.length - 1) {
        tryPerm(arr);
        return;
      }
      for (let i = k; i < arr.length; i++) {
        [arr[k], arr[i]] = [arr[i], arr[k]];
        permute(arr, k + 1);
        [arr[k], arr[i]] = [arr[i], arr[k]];
      }
    };
    permute(indices, 0);
    return best;
  }

  // Greedy fallback for large arrays.
  const used = new Set<number>();
  const matches: FieldMatch[] = [];
  for (const exp of expected) {
    let bestJ = -1;
    let bestS = -1;
    for (let j = 0; j < actual.length; j++) {
      if (used.has(j)) continue;
      const m = matchItem(exp, actual[j]);
      const s = matchScore(m);
      if (s > bestS) {
        bestS = s;
        bestJ = j;
      }
    }
    if (bestJ < 0) break;
    used.add(bestJ);
    matches.push(matchItem(exp, actual[bestJ]));
  }
  return matches;
}

function scoreFixture(fixture: ClassificationFixture, actual: ClassifiedItem[]) {
  const countMatch = fixture.expected.length === actual.length;
  const itemMatches = bestAlignment(fixture.expected, actual);

  const accumulate = (key: keyof FieldMatch) =>
    itemMatches.length === 0
      ? 1 // vacuously correct when both expected and actual are empty
      : itemMatches.filter((m) => m[key]).length / itemMatches.length;

  const perFieldAccuracy: Record<keyof FieldMatch, number> = {
    type: accumulate('type'),
    category: accumulate('category'),
    urgency: accumulate('urgency'),
    bucket: accumulate('bucket'),
    title: accumulate('title'),
  };

  return { countMatch, itemMatches, perFieldAccuracy };
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
    const result = await classifyTranscript(fixture.transcript, anthropic);
    const elapsedMs = Date.now() - startedAt;
    totalElapsedMs += elapsedMs;

    const score = scoreFixture(fixture, result.items);

    if (score.countMatch) countMatches++;
    for (const key of MATCH_FIELDS) {
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
        const flags = MATCH_FIELDS.filter((k) => !m[k]).map((k) => {
          if (k === 'title') return `title("${a.title}"!~"${e.titleIncludes}")`;
          return `${k}(${a[k]}≠${e[k]})`;
        }).join(' ');
        if (flags) console.log(`    #${i}: ${flags}`);
      }
    }
  }

  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  const cacheReadShare =
    totalCacheReadTokens /
    (totalCacheReadTokens + totalCacheWriteTokens + totalInputTokens || 1);

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
    console.log('  Fix: expand src/prompts/classification.ts, then verify with');
    console.log('       `npm run count:prompt`.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
