import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from './config';
import { CLASSIFICATION_SYSTEM_PROMPT } from './prompts/classification';
import type { ClassifiedItem } from './types';

// Prompt lives in ./prompts/classification.ts so it can be diffed, token-
// counted, and grown past Haiku 4.5's 4096-token minimum cacheable prefix
// without noise-polluting this file. Any byte change there invalidates the
// prompt cache for every downstream request — keep per-request content out.

const ITEM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['task', 'idea', 'project'] },
          title: { type: 'string' },
          body: { type: 'string' },
          category: { type: 'string' },
          categoryColor: { type: 'string' },
          energyLevel: { type: 'integer', enum: [1, 2, 3] },
          urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
          bucket: { type: 'string', enum: ['today', 'tomorrow', 'someday'] },
        },
        required: [
          'type',
          'title',
          'category',
          'categoryColor',
          'energyLevel',
          'urgency',
          'bucket',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

export interface ClassifyResult {
  items: ClassifiedItem[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  return _client;
}

/**
 * Classify a transcript into structured items via Claude Haiku 4.5.
 *
 * - Pinned to the dated snapshot (see config.ts) to avoid alias drift.
 * - System prompt carries a `cache_control: ephemeral` breakpoint so the
 *   (stable) prompt + few-shot block cache across requests.
 * - Uses `output_config.format` structured outputs so we get guaranteed
 *   valid JSON matching the schema; we still JSON.parse the first text
 *   block because `messages.create` returns the raw text.
 */
export async function classifyTranscript(
  transcript: string,
): Promise<ClassifyResult> {
  const response = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: CLASSIFICATION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: ITEM_JSON_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: `Transcript: "${transcript.replace(/"/g, '\\"')}"`,
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!textBlock) {
    throw new Error('Claude response missing text block');
  }

  let parsed: { items: ClassifiedItem[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `Failed to parse Claude JSON output: ${(err as Error).message}`,
    );
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error('Claude output missing items array');
  }

  return {
    items: parsed.items,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
