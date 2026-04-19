// Local copy of the classification-relevant subset of src/types/models.ts.
// Keeping this separate avoids pulling the whole app tree into the functions
// build and lets the functions package ship with a simple rootDir-based tsconfig.

export type ItemType = 'task' | 'idea' | 'project';
export type Urgency = 'high' | 'medium' | 'low';
export type EnergyLevel = 1 | 2 | 3;
export type Bucket = 'today' | 'tomorrow' | 'someday';
export type EntityType = 'person' | 'place' | 'thing';

/**
 * Shape Claude returns for each extracted item (before we stamp ids and
 * Firestore timestamps in processRecording).
 *
 * topicMatch and topicProposal are mutually exclusive. Exactly one of them
 * may be present per item; both may be absent when the item doesn't belong
 * in any persistent topic.
 */
export interface ClassifiedItem {
  type: ItemType;
  title: string;
  body?: string;
  category: string;
  categoryColor: string;
  energyLevel: EnergyLevel;
  urgency: Urgency;
  bucket: Bucket;
  topicMatch?: string;    // id of an existing TopicDoc
  topicProposal?: string; // name of a new topic to create after user approval
}

export interface EntityProposal {
  name: string;
  type: EntityType;
  relationship?: string;
}

/**
 * Lightweight snapshot of the user's world passed to Claude on every call
 * so it can reuse existing topics/entities instead of inventing new ones.
 */
export interface ClassificationContext {
  existingTopics: Array<{ id: string; name: string; itemCount: number }>;
  knownEntities: Record<
    string,
    { type: EntityType; relationship?: string }
  >;
  recentItemTitles: Array<{ title: string; category: string }>;
}
