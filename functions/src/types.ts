// Local copy of the classification-relevant subset of src/types/models.ts.
// Keeping this separate avoids pulling the whole app tree into the functions
// build and lets the functions package ship with a simple rootDir-based tsconfig.

export type ItemType = 'task' | 'idea' | 'project';
export type Urgency = 'high' | 'medium' | 'low';
export type EnergyLevel = 1 | 2 | 3;
export type Bucket = 'today' | 'tomorrow' | 'someday';

/**
 * Shape Claude returns for each extracted item (before we stamp ids and
 * Firestore timestamps in processRecording).
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
}
