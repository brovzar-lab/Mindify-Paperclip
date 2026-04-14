// Canonical Firestore document shapes for Mindify. Keep in sync with the data
// model in TECHNICAL_PLAN.md. Cloud Functions has a mirror of the subset it
// needs in functions/src/types.ts (intentional duplication — keeps the
// functions build self-contained with a simple tsconfig).

export type ItemType = 'task' | 'idea' | 'project';
export type Urgency = 'high' | 'medium' | 'low';
export type EnergyLevel = 1 | 2 | 3;
export type Bucket = 'today' | 'tomorrow' | 'someday';

export interface UserDoc {
  uid: string;
  createdAt: number;
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
  };
}

export interface RecordingDoc {
  id: string;
  userId: string;
  audioUrl: string;
  transcript?: string;
  createdAt: number;
  processedAt?: number;
}

export interface ItemDoc {
  id: string;
  userId: string;
  recordingId: string;
  type: ItemType;
  title: string;
  body?: string | null;
  category: string;
  categoryColor: string; // hex, e.g. "#f6b26b"
  energyLevel: EnergyLevel;
  urgency: Urgency;
  bucket: Bucket;
  groupId?: string | null;
  createdAt: number;
  completedAt?: number | null;
}

export interface GroupDoc {
  id: string;
  userId: string;
  title: string;
  category: string;
  itemIds: string[];
  createdAt: number;
}
