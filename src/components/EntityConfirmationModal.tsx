import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useEntitySuggestions } from '@/hooks/useEntitySuggestions';
import { useAppStore } from '@/state/store';
import { theme } from '@/theme';
import type { EntitySuggestionDoc } from '@/types/models';

/**
 * Surfaces a pending entity suggestion as a modal the first time the
 * user opens the Brain after a notification fires (or immediately after
 * a recording, if they never backgrounded the app).
 *
 * Approving writes to users/{uid}.entities (merge=true) and flips the
 * suggestion status. Rejecting just flips status so it stops showing.
 */
export function EntityConfirmationModal() {
  const { suggestions } = useEntitySuggestions();
  const pendingId = useAppStore((s) => s.pendingEntitySuggestionId);
  const clearPending = useAppStore((s) => s.setPendingEntitySuggestionId);

  // Prefer the suggestion the user just tapped a notification for;
  // otherwise fall back to the most recent pending one so they still
  // see it if they skipped the notification.
  const current = useMemo<EntitySuggestionDoc | undefined>(() => {
    if (pendingId) {
      const match = suggestions.find((s) => s.id === pendingId);
      if (match) return match;
    }
    return suggestions[0];
  }, [pendingId, suggestions]);

  useEffect(() => {
    // If the deep-linked suggestion is gone (already resolved elsewhere)
    // clear the pending id so the modal doesn't keep trying to find it.
    if (pendingId && !suggestions.some((s) => s.id === pendingId)) {
      clearPending(null);
    }
  }, [pendingId, suggestions, clearPending]);

  const visible = !!current;

  async function approve(s: EntitySuggestionDoc) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        entities: {
          [s.name]: {
            type: s.type,
            relationship: s.relationship ?? null,
            createdAt: serverTimestamp(),
          },
        },
      },
      { merge: true },
    );
    await updateDoc(doc(db, 'entitySuggestions', s.id), { status: 'approved' });
    if (pendingId === s.id) clearPending(null);
  }

  async function reject(s: EntitySuggestionDoc) {
    await updateDoc(doc(db, 'entitySuggestions', s.id), { status: 'rejected' });
    if (pendingId === s.id) clearPending(null);
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => current && reject(current)}
    >
      <View style={styles.backdrop}>
        {current && (
          <View style={styles.card}>
            <Text style={styles.kicker}>Quick check</Text>
            <Text style={styles.question}>
              {current.relationship
                ? `Is ${current.name} your ${current.relationship}?`
                : `Who is ${current.name}?`}
            </Text>
            <Text style={styles.hint}>
              We'll remember this so Mindify understands your world next
              time you mention {current.name}.
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => reject(current)}
                style={[styles.btn, styles.btnGhost]}
              >
                <Text style={styles.btnGhostText}>No / skip</Text>
              </Pressable>
              <Pressable
                onPress={() => approve(current)}
                style={[styles.btn, styles.btnPrimary]}
              >
                <Text style={styles.btnPrimaryText}>Yes, save</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
  },
  kicker: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: theme.fontWeight.semibold,
  },
  question: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.sm,
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  btn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  btnGhost: { backgroundColor: theme.colors.surfaceMuted },
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
