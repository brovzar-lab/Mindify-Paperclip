// Canonical Firestore document shapes for Mindify. Keep in sync with the data
// model in TECHNICAL_PLAN.md. Cloud Functions has a mirror of the subset it
// needs in functions/src/types.ts (intentional duplication — keeps the
// functions build self-contained with a simple tsconfig).

export type ItemType = 'task' | 'idea' | 'project';
export type Urgency = 'high' | 'medium' | 'low';
export type EnergyLevel = 1 | 2 | 3;
export type Bucket = 'today' | 'tomorrow' | 'someday';
export type EntityType = 'person' | 'place' | 'thing';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface EntityDoc {
  // Stored as a map value on UserDoc.entities, keyed by canonical entity name.
  // Example key: "Alex". Relationship is the short descriptor the user
  // confirms ("daughter", "boss", "favorite restaurant").
  type: EntityType;
  relationship?: string;
  createdAt: number;
}

export interface UserDoc {
  uid: string;
  createdAt: number;
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    // Set after the user grants Expo notification permission. Absent means
    // the user hasn't opted in yet (or the platform doesn't support it).
    expoPushToken?: string;
  };
  // Flat entity map, keyed by canonical name. Populated only via user
  // approval of an EntitySuggestionDoc.
  entities?: Record<string, EntityDoc>;
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
  // Assigned by Claude via topicMatch against an existing TopicDoc id, or
  // stamped after the user approves a TopicSuggestionDoc.
  topicId?: string | null;
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

export interface TopicDoc {
  id: string;
  userId: string;
  name: string; // "Groceries", "Movie Ideas", "Alex (daughter)"
  itemIds: string[];
  itemCount: number; // denormalized for list rendering
  createdAt: number;
  lastUpdatedAt: number;
}

export interface TopicSuggestionDoc {
  id: string;
  userId: string;
  name: string;
  proposedItemIds: string[];
  sourceRecordingId: string;
  createdAt: number;
  status: SuggestionStatus;
}

export interface EntitySuggestionDoc {
  id: string;
  userId: string;
  name: string;
  type: EntityType;
  relationship?: string;
  sourceRecordingId: string;
  createdAt: number;
  status: SuggestionStatus;
}
