/**
 * Seed ~10 realistic demo items into Firestore so The Brain has content
 * for UI review without the Cloud Functions pipeline deployed.
 *
 * Usage (from functions/):
 *   npx tsx scripts/seedDemo.ts <uid>
 *
 * Get your anonymous UID from the Firebase console (Authentication → Users)
 * or from the React Native debug log when the app boots.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: npx tsx scripts/seedDemo.ts <uid>');
  process.exit(1);
}

initializeApp({ projectId: 'mindify-93328' });
const db = getFirestore();

const recordingId = `seed-${Date.now()}`;
const now = Timestamp.now();
const items = [
  { type: 'task',    title: 'Pick up prescription',             category: 'Health',   categoryColor: '#8dc4a4', energyLevel: 1, urgency: 'high',   bucket: 'today' },
  { type: 'task',    title: 'Finish Q2 deck',                   category: 'Work',     categoryColor: '#7a9fd1', energyLevel: 3, urgency: 'high',   bucket: 'today',    body: 'Founders meeting Friday 3pm; needs outline first.' },
  { type: 'task',    title: 'Dispute DoorDash double charge',   category: 'Finance',  categoryColor: '#6fa58b', energyLevel: 2, urgency: 'high',   bucket: 'today' },
  { type: 'task',    title: 'Buy eggs and bread',               category: 'Errands',  categoryColor: '#f6b26b', energyLevel: 1, urgency: 'medium', bucket: 'today' },
  { type: 'task',    title: 'Call mom this weekend',             category: 'Social',   categoryColor: '#e89a9a', energyLevel: 1, urgency: 'medium', bucket: 'tomorrow' },
  { type: 'task',    title: 'Unclog bathroom sink',             category: 'Home',     categoryColor: '#c8a882', energyLevel: 2, urgency: 'medium', bucket: 'tomorrow' },
  { type: 'task',    title: 'Start morning meditation',         category: 'Health',   categoryColor: '#8dc4a4', energyLevel: 1, urgency: 'medium', bucket: 'tomorrow', body: 'To help with anxiety.' },
  { type: 'idea',    title: 'Blog post on ADHD time perception',category: 'Creative', categoryColor: '#d99ec2', energyLevel: 2, urgency: 'low',    bucket: 'someday' },
  { type: 'project', title: 'Learn Rust',                       category: 'Learning', categoryColor: '#7dabc7', energyLevel: 3, urgency: 'low',    bucket: 'someday',  body: 'Work through the Rust book.' },
  { type: 'idea',    title: 'Mindify for Teams concept',        category: 'Work',     categoryColor: '#7a9fd1', energyLevel: 3, urgency: 'low',    bucket: 'someday',  body: 'Private brains with selective sharing. Target small agencies.' },
] as const;

async function main() {
  const batch = db.batch();

  batch.set(db.doc(`recordings/${recordingId}`), {
    userId: uid,
    audioUrl: '',
    transcript: '(seeded demo data)',
    createdAt: now,
    processedAt: now,
  });

  for (const item of items) {
    const ref = db.collection('items').doc();
    batch.set(ref, {
      userId: uid,
      recordingId,
      ...item,
      createdAt: now,
      completedAt: null,
    });
  }

  await batch.commit();
  console.log(`Seeded ${items.length} items for user ${uid} (recording ${recordingId}).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
