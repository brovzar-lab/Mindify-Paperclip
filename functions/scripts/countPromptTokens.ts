/**
 * Report the authoritative token count of the classification system prompt
 * via the Anthropic countTokens API, and flag whether we clear Haiku 4.5's
 * 4096-token minimum cacheable prefix.
 *
 * Usage (from functions/):
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/countPromptTokens.ts
 *
 * WS4 should run this after any edit to src/prompts/classification.ts.
 * If it reports <4096 tokens, the `cache_control: ephemeral` breakpoint
 * silently no-ops on Haiku 4.5 and classification-pipeline cache reads
 * will stay at zero.
 */
import Anthropic from '@anthropic-ai/sdk';
import { CLASSIFICATION_SYSTEM_PROMPT } from '../src/prompts/classification';
import { CLAUDE_MODEL } from '../src/config';

const HAIKU_45_CACHE_FLOOR_TOKENS = 4096;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is required.');
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });

  const count = await anthropic.messages.countTokens({
    model: CLAUDE_MODEL,
    system: [{ type: 'text', text: CLASSIFICATION_SYSTEM_PROMPT }],
    // The runtime request puts the transcript in a user message after the
    // cached system prefix. We're measuring just the cacheable prefix, so
    // pass a minimal placeholder user turn — its tokens are negligible.
    messages: [{ role: 'user', content: '.' }],
  });

  const tokens = count.input_tokens;
  const chars = CLASSIFICATION_SYSTEM_PROMPT.length;
  const charsPerToken = (chars / tokens).toFixed(2);
  const clears = tokens >= HAIKU_45_CACHE_FLOOR_TOKENS;

  console.log(`Model:                      ${CLAUDE_MODEL}`);
  console.log(`Prompt chars:               ${chars}`);
  console.log(`Prompt tokens (countTokens):${tokens}`);
  console.log(`Chars/token:                ${charsPerToken}`);
  console.log(`Haiku 4.5 cache floor:      ${HAIKU_45_CACHE_FLOOR_TOKENS}`);
  console.log(
    `Clears floor:               ${clears ? 'YES' : 'NO'}  (${clears ? 'cache will engage' : `need +${HAIKU_45_CACHE_FLOOR_TOKENS - tokens} tokens`})`,
  );

  if (!clears) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
