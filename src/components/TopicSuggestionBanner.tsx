import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useTopicSuggestions } from '@/hooks/useTopicSuggestions';
import { theme } from '@/theme';
import type { TopicSuggestionDoc } from '@/types/models';

/**
 * Surfaces the most recent pending topic proposal above the Brain list.
 * Only one at a time to avoid overwhelming the user — additional
 * suggestions queue up and appear as each is resolved.
 *
 * Approving creates the TopicDoc client-side (Firestore rules allow
 * create-your-own), stamps topicId onto every proposed item in one
 * batch, then marks the suggestion approved. Rejecting just flips the
 * suggestion status to 'rejected' so it stops showing.
 */
export function TopicSuggestionBanner() {
  const { suggestions } = useTopicSuggestions();
  const current = suggestions[0];

  if (!current) return null;

  async function approve(s: TopicSuggestionDoc) {
    const user = auth.currentUser;
    if (!user) return;
    const batch = writeBatch(db);
    const topicRef = doc(collection(db, 'topics'));
    batch.set(topicRef, {
      userId: user.uid,
      name: s.name,
      itemIds: s.proposedItemIds,
      itemCount: s.proposedItemIds.length,
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    });
    for (const itemId of s.proposedItemIds) {
      batch.update(doc(db, 'items', itemId), { topicId: topicRef.id });
    }
    batch.update(doc(db, 'topicSuggestions', s.id), { status: 'approved' });
    await batch.commit();
  }

  async function reject(s: TopicSuggestionDoc) {
    await updateDoc(doc(db, 'topicSuggestions', s.id), { status: 'rejected' });
  }

  return (
    <View style={styles.banner}>
      <View style={styles.body}>
        <Text style={styles.prompt}>Cluster into a topic?</Text>
        <Text style={styles.name}>{current.name}</Text>
        <Text style={styles.sub}>
          {current.proposedItemIds.length} item
          {current.proposedItemIds.length === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => reject(current)}
          style={[styles.btn, styles.btnGhost]}
        >
          <Text style={styles.btnGhostText}>Not now</Text>
        </Pressable>
        <Pressable
          onPress={() => approve(current)}
          style={[styles.btn, styles.btnPrimary]}
        >
          <Text style={styles.btnPrimaryText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentMuted,
    borderRadius: theme.radii.md,
    gap: theme.spacing.md,
  },
  body: { flex: 1 },
  prompt: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: theme.fontWeight.semibold,
  },
  name: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    marginTop: 2,
  },
  sub: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.xs },
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
});
