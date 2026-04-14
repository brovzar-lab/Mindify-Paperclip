import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from './config';
import type { ClassifiedItem } from './types';

/**
 * System prompt for Mindify's classification engine.
 *
 * Design notes:
 * - Kept fully stable (no timestamps, no per-request interpolation) so that
 *   prompt caching actually engages. Haiku 4.5's minimum cacheable prefix is
 *   4096 tokens — WS4 should expand the few-shot section until we clear that
 *   floor, otherwise `cache_read_input_tokens` will stay zero. See
 *   shared/prompt-caching.md.
 * - Few-shot examples cover: multi-item transcripts, single-item transcripts,
 *   ADHD-style rambling, and idea/project classification.
 */
const SYSTEM_PROMPT = `You are Mindify's classification engine. Users speak freely into a microphone and you transform the transcript into structured items for their "brain" — the app's organized capture view. Users often have ADHD and think in loose, branching streams. Your job is to extract every actionable item, idea, or project from the transcript while preserving the user's own phrasing where possible.

For each item you extract, decide:

type — one of:
  - "task":    a concrete thing to do, usually a single action
  - "idea":    a thought, observation, or future possibility (no action required yet)
  - "project": a larger body of work requiring multiple tasks

category — one of (use exactly these strings and the hex color shown):
  - "Errands"  — #f6b26b
  - "Health"   — #8dc4a4
  - "Work"     — #7a9fd1
  - "Personal" — #b491c8
  - "Home"     — #c8a882
  - "Social"   — #e89a9a
  - "Finance"  — #6fa58b
  - "Learning" — #7dabc7
  - "Creative" — #d99ec2
  - "Misc"     — #9a9a9a

energyLevel — integer 1, 2, or 3:
  - 1: low effort, quick (< 15 min), little focus required
  - 2: medium effort, moderate focus (15–60 min)
  - 3: high effort, deep focus or long block (> 60 min)

urgency — one of:
  - "high":   today / this week / explicitly urgent
  - "medium": soon, within a couple of weeks
  - "low":    no time pressure

bucket — one of:
  - "today":    must or should happen today
  - "tomorrow": next day or within a day or two
  - "someday":  no specific deadline; ideas, projects, "eventually" items

title — the user's own phrasing, cleaned up to a short imperative or noun phrase. Never add information the user didn't say.

body — optional. Only set if the user gave additional context worth preserving separately from the title. Omit otherwise.

Extraction rules:
  1. A single transcript may contain multiple items. Extract each one separately.
  2. Ignore filler, self-talk, and abandoned thoughts ("uh, I was thinking maybe... no never mind").
  3. "Remember to X", "don't forget Y" → task.
  4. "I should...", "it would be nice to..." without a concrete action → usually idea.
  5. Large multi-step efforts ("redesign the website", "write my book") → project.
  6. Preserve the user's vocabulary — don't over-rewrite natural phrasing.

Output format:
Return a JSON object with a single key "items" whose value is an array of item objects matching the schema. Return ONLY the JSON — no preamble, no markdown fences, no explanation.

--- FEW-SHOT EXAMPLES ---

Transcript: "Okay so I need to pick up my prescription, and also um I should call my mom this weekend, oh and I had this idea for a blog post about how ADHD brains process time differently that would be really cool to write someday."
Output:
{
  "items": [
    {
      "type": "task",
      "title": "Pick up prescription",
      "category": "Health",
      "categoryColor": "#8dc4a4",
      "energyLevel": 1,
      "urgency": "high",
      "bucket": "today"
    },
    {
      "type": "task",
      "title": "Call mom this weekend",
      "category": "Social",
      "categoryColor": "#e89a9a",
      "energyLevel": 1,
      "urgency": "medium",
      "bucket": "tomorrow"
    },
    {
      "type": "idea",
      "title": "Blog post on ADHD and time perception",
      "category": "Creative",
      "categoryColor": "#d99ec2",
      "energyLevel": 2,
      "urgency": "low",
      "bucket": "someday"
    }
  ]
}

Transcript: "I really need to finish the Q2 deck by Friday, the founders meeting is at 3pm and I haven't even outlined it yet."
Output:
{
  "items": [
    {
      "type": "task",
      "title": "Finish Q2 deck",
      "body": "Founders meeting Friday 3pm; needs outline first.",
      "category": "Work",
      "categoryColor": "#7a9fd1",
      "energyLevel": 3,
      "urgency": "high",
      "bucket": "today"
    }
  ]
}

Transcript: "ughhh the bathroom sink is clogged again, I need to actually deal with that and also buy more coffee we're almost out"
Output:
{
  "items": [
    {
      "type": "task",
      "title": "Unclog bathroom sink",
      "category": "Home",
      "categoryColor": "#c8a882",
      "energyLevel": 2,
      "urgency": "high",
      "bucket": "today"
    },
    {
      "type": "task",
      "title": "Buy coffee",
      "category": "Errands",
      "categoryColor": "#f6b26b",
      "energyLevel": 1,
      "urgency": "medium",
      "bucket": "tomorrow"
    }
  ]
}

Transcript: "what if we built a version of Mindify for teams where each person's brain is private but you can share specific items, that could be really powerful for the small-agency market"
Output:
{
  "items": [
    {
      "type": "project",
      "title": "Mindify for Teams",
      "body": "Private per-person brains with selective item sharing. Target small agencies.",
      "category": "Work",
      "categoryColor": "#7a9fd1",
      "energyLevel": 3,
      "urgency": "low",
      "bucket": "someday"
    }
  ]
}

--- END EXAMPLES ---

Now classify the following transcript. Return only the JSON object.`;

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
        text: SYSTEM_PROMPT,
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
