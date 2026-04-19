import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from './config';
import { CLASSIFICATION_SYSTEM_PROMPT } from './prompts/classification';
import type {
  ClassifiedItem,
  ClassificationContext,
  EntityProposal,
} from './types';

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
          // Cross-recording clustering. Mutually exclusive: topicMatch
          // references an existing TopicDoc id (from the context we pass
          // in the user message); topicProposal names a new topic to be
          // created after user approval. Both optional — items without
          // either stay outside the topic layer.
          topicMatch: { type: 'string' },
          topicProposal: { type: 'string' },
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
    // Entity proposals are emitted at the response envelope level (not
    // per-item) because a single transcript can surface one entity
    // ("my daughter Alex") that's referenced by multiple items.
    entityProposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['person', 'place', 'thing'] },
          relationship: { type: 'string' },
        },
        required: ['name', 'type'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

export interface ClassifyResult {
  items: ClassifiedItem[];
  entityProposals: EntityProposal[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

// Default client uses the defineSecret-backed key (the path the Cloud
// Function runs through). Test runners and benchmarks can pass their own
// pre-configured `Anthropic` instance to classifyTranscript and skip
// SecretParam.value() entirely — avoids the "does defineSecret fall back
// to process.env in every SDK version" footgun.
let _defaultClient: Anthropic | null = null;
function defaultClient(): Anthropic {
  if (!_defaultClient) {
    _defaultClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  }
  return _defaultClient;
}

/**
 * Serialize the per-user context block that precedes the transcript in the
 * user message. Stable JSON ordering keeps this deterministic so prompt
 * caches further upstream (Whisper temp=0 → same transcript → same context)
 * stay warm across repeated recordings.
 */
function formatContext(context: ClassificationContext): string {
  const topics = context.existingTopics.length
    ? JSON.stringify(
        context.existingTopics.map((t) => ({ id: t.id, name: t.name })),
      )
    : '[]';
  const entities = Object.keys(context.knownEntities).length
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(context.knownEntities).map(([name, e]) => [
            name,
            e.relationship ?? e.type,
          ]),
        ),
      )
    : '{}';
  const recent = context.recentItemTitles.length
    ? JSON.stringify(
        context.recentItemTitles.map((r) => `${r.title} [${r.category}]`),
      )
    : '[]';
  return [
    `EXISTING TOPICS: ${topics}`,
    `KNOWN ENTITIES: ${entities}`,
    `RECENT ITEMS: ${recent}`,
  ].join('\n');
}

/**
 * Classify a transcript into structured items via Claude Haiku 4.5.
 *
 * - Pinned to the dated snapshot (see config.ts) to avoid alias drift.
 * - System prompt carries a `cache_control: ephemeral` breakpoint so the
 *   (stable) prompt + few-shot block cache across requests.
 * - Per-user context (topics, entities, recent items) rides in the user
 *   message so it stays out of the cached prefix.
 * - Uses `output_config.format` structured outputs so we get guaranteed
 *   valid JSON matching the schema; we still JSON.parse the first text
 *   block because `messages.create` returns the raw text.
 *
 * @param transcript        The Whisper output to classify.
 * @param context           Per-user topics/entities/recent items.
 * @param anthropicClient   Optional override; omit in production so the
 *                          function reads its secret from Firebase.
 */
export async function classifyTranscript(
  transcript: string,
  context: ClassificationContext,
  anthropicClient?: Anthropic,
): Promise<ClassifyResult> {
  const anthropic = anthropicClient ?? defaultClient();
  const userMessage = `${formatContext(context)}\n\nTranscript: "${transcript.replace(/"/g, '\\"')}"`;

  const response = await anthropic.messages.create({
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
        content: userMessage,
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!textBlock) {
    throw new Error('Claude response missing text block');
  }

  let parsed: { items: ClassifiedItem[]; entityProposals?: EntityProposal[] };
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

  // Guard: enforce topicMatch / topicProposal mutual exclusion client-side
  // in case the schema's `oneOf` isn't honored by the structured-output
  // implementation (some JSON Schema features are partially supported).
  const items = parsed.items.map((item) => {
    if (item.topicMatch && item.topicProposal) {
      // Match wins — it's the safer, non-destructive path (no new topic
      // gets proposed unnecessarily).
      const { topicProposal: _drop, ...rest } = item;
      return rest;
    }
    return item;
  });

  return {
    items,
    entityProposals: Array.isArray(parsed.entityProposals)
      ? parsed.entityProposals
      : [],
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
