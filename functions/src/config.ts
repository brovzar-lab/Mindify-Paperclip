import { defineSecret } from 'firebase-functions/params';

// Secrets — set via `firebase functions:secrets:set OPENAI_API_KEY` etc.
// The deployment attaches them to the function; runtime reads via .value().
export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/**
 * Pinned Claude model snapshot.
 *
 * Using the dated snapshot rather than the `claude-haiku-4-5` alias so
 * dev / staging / prod all resolve to the same model bytes. See
 * TECHNICAL_PLAN.md → Key Technical Decisions.
 */
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

/**
 * End-to-end latency budget, record-stop → items visible in The Brain.
 * WS4 benchmarks against this and escalates (min-instances, streaming
 * transcription) if the budget isn't achievable.
 */
export const LATENCY_BUDGET_MS = 8000;
