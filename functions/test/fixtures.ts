import type {
  ItemType,
  Urgency,
  Bucket,
} from '../src/types';

/**
 * A single expected item from a test fixture. Title is fuzzy-matched (case-
 * insensitive substring) so we don't break the runner every time Claude
 * chooses a slightly different phrasing. energyLevel is intentionally NOT
 * asserted — it's the subjective-est field and small wobble is acceptable.
 */
export interface ExpectedItem {
  type: ItemType;
  category: string;
  urgency: Urgency;
  bucket: Bucket;
  titleIncludes: string;
}

export interface ClassificationFixture {
  id: string;
  description: string;
  transcript: string;
  expected: ExpectedItem[];
}

/**
 * WS4 test corpus. Covers the edge cases called out in the technical plan:
 *   - Multiple items in one recording
 *   - Ambiguous phrasing
 *   - Filler + abandoned thoughts
 *   - Single-item and micro-transcripts
 *   - Idea vs task vs project disambiguation
 *   - Cross-category clusters
 *   - Pure noise / empty audio
 *
 * Add new cases freely. The runner reports per-fixture results; no fixture
 * is load-bearing on its own.
 */
export const FIXTURES: ClassificationFixture[] = [
  {
    id: 'multi-item-mixed-categories',
    description: 'Canonical multi-item transcript across categories',
    transcript:
      "Okay so I need to pick up my prescription, and also um I should call my mom this weekend, oh and I had this idea for a blog post about how ADHD brains process time differently that would be really cool to write someday.",
    expected: [
      { type: 'task', category: 'Health', urgency: 'high', bucket: 'today', titleIncludes: 'prescription' },
      { type: 'task', category: 'Social', urgency: 'medium', bucket: 'tomorrow', titleIncludes: 'mom' },
      { type: 'idea', category: 'Creative', urgency: 'low', bucket: 'someday', titleIncludes: 'adhd' },
    ],
  },
  {
    id: 'single-work-task-with-deadline',
    description: 'One Work task with an explicit deadline and body',
    transcript:
      "I really need to finish the Q2 deck by Friday, the founders meeting is at 3pm and I haven't even outlined it yet.",
    expected: [
      { type: 'task', category: 'Work', urgency: 'high', bucket: 'today', titleIncludes: 'deck' },
    ],
  },
  {
    id: 'home-plus-errand',
    description: 'Home vs Errands disambiguation in one transcript',
    transcript:
      "ughhh the bathroom sink is clogged again, I need to actually deal with that and also buy more coffee we're almost out",
    expected: [
      { type: 'task', category: 'Home', urgency: 'high', bucket: 'today', titleIncludes: 'sink' },
      { type: 'task', category: 'Errands', urgency: 'medium', bucket: 'tomorrow', titleIncludes: 'coffee' },
    ],
  },
  {
    id: 'project-speculation',
    description: '"What if we built X" → single project',
    transcript:
      "what if we built a version of Mindify for teams where each person's brain is private but you can share specific items, that could be really powerful for the small-agency market",
    expected: [
      { type: 'project', category: 'Work', urgency: 'low', bucket: 'someday', titleIncludes: 'team' },
    ],
  },
  {
    id: 'finance-cluster',
    description: 'Three Finance tasks — good candidate for smart grouping',
    transcript:
      "ugh I keep forgetting to transfer money to my savings, and I need to dispute that double charge from doordash, and also my annual subscription for notion is about to renew and I don't use it anymore",
    expected: [
      { type: 'task', category: 'Finance', urgency: 'medium', bucket: 'tomorrow', titleIncludes: 'saving' },
      { type: 'task', category: 'Finance', urgency: 'high', bucket: 'today', titleIncludes: 'doordash' },
      { type: 'task', category: 'Finance', urgency: 'high', bucket: 'today', titleIncludes: 'notion' },
    ],
  },
  {
    id: 'learning-project-plus-task',
    description: 'Big Learning project + concrete Learning task',
    transcript:
      "I really want to learn rust this year, maybe work through the book, and oh Primeagen posted a new video on generics I should watch tonight",
    expected: [
      { type: 'project', category: 'Learning', urgency: 'low', bucket: 'someday', titleIncludes: 'rust' },
      { type: 'task', category: 'Learning', urgency: 'high', bucket: 'today', titleIncludes: 'video' },
    ],
  },
  {
    id: 'micro-transcript',
    description: 'Minimal single-utterance recording',
    transcript: 'water the plants',
    expected: [
      { type: 'task', category: 'Home', urgency: 'high', bucket: 'today', titleIncludes: 'water' },
    ],
  },
  {
    id: 'should-disambiguation',
    description: '"I should X" — concrete (task) vs abstract (idea)',
    transcript:
      "I should probably start meditating in the mornings, it would help with the anxiety stuff, and also I should probably just be more organized in general",
    expected: [
      { type: 'task', category: 'Health', urgency: 'medium', bucket: 'tomorrow', titleIncludes: 'meditat' },
      { type: 'idea', category: 'Personal', urgency: 'low', bucket: 'someday', titleIncludes: 'organiz' },
    ],
  },
  {
    id: 'filler-and-abandoned',
    description: 'Heavy filler; includes an abandoned thought to skip',
    transcript:
      "ok um let me think about uhh what do I need to do today, oh right, drop off the dry cleaning, and actually no wait I already did that yesterday, ok so just uhh pick up eggs and bread on the way home and maybe get gas",
    expected: [
      { type: 'task', category: 'Errands', urgency: 'high', bucket: 'today', titleIncludes: 'egg' },
      { type: 'task', category: 'Errands', urgency: 'medium', bucket: 'today', titleIncludes: 'gas' },
    ],
  },
  {
    id: 'telegraphic-list',
    description: 'Comma-separated telegraphic list — four mixed categories',
    transcript: 'pay rent, book therapist appt, gym later, dinner with Sarah Friday',
    expected: [
      { type: 'task', category: 'Finance', urgency: 'high', bucket: 'today', titleIncludes: 'rent' },
      { type: 'task', category: 'Health', urgency: 'medium', bucket: 'today', titleIncludes: 'therapist' },
      { type: 'task', category: 'Health', urgency: 'medium', bucket: 'today', titleIncludes: 'gym' },
      { type: 'task', category: 'Social', urgency: 'medium', bucket: 'tomorrow', titleIncludes: 'sarah' },
    ],
  },
  {
    id: 'pure-noise',
    description: 'Whisper gibberish / near-silent transcript → empty items',
    transcript: 'uhh... mmm.',
    expected: [],
  },
  {
    id: 'creative-idea-burst',
    description: 'Stream of creative ideas with no action',
    transcript:
      "I keep thinking about a children's book where the main character is a very anxious squirrel, like their whole personality is worrying about winter. That could be really charming.",
    expected: [
      { type: 'idea', category: 'Creative', urgency: 'low', bucket: 'someday', titleIncludes: 'squirrel' },
    ],
  },
];
