import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CategoryChip } from '@/components/CategoryChip';
import { EnergyBars } from '@/components/EnergyBars';
import { UrgencyDot } from '@/components/UrgencyDot';
import { Loading } from '@/components/Loading';
import { useItem } from '@/hooks/useItem';
import { theme } from '@/theme';
import type { Bucket } from '@/types/models';
import type { ScreenProps } from '@/navigation/types';

const BUCKETS: Bucket[] = ['today', 'tomorrow', 'someday'];

export function ItemDetailScreen({ route }: ScreenProps<'ItemDetail'>) {
  const { itemId } = route.params;
  const nav = useNavigation();
  const { item, loading } = useItem(itemId);
  const [optimisticBucket, setOptimisticBucket] = useState<Bucket | null>(null);
  const [optimisticComplete, setOptimisticComplete] = useState(false);

  if (loading || !item) {
    return <Loading message={loading ? 'Loading...' : 'Item not found.'} />;
  }

  const completed = optimisticComplete || !!item.completedAt;
  const displayBucket = optimisticBucket ?? item.bucket;

  async function handleComplete() {
    if (!item || completed) return;
    setOptimisticComplete(true);
    try {
      await updateDoc(doc(db, 'items', item.id), {
        completedAt: serverTimestamp(),
      });
      nav.goBack();
    } catch {
      setOptimisticComplete(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    await deleteDoc(doc(db, 'items', item.id));
    nav.goBack();
  }

  async function handleBucketChange(bucket: Bucket) {
    if (!item || displayBucket === bucket) return;
    setOptimisticBucket(bucket);
    try {
      await updateDoc(doc(db, 'items', item.id), { bucket });
    } catch {
      setOptimisticBucket(null);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={16}>
          <Text style={styles.back}>← Brain</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <View style={styles.metaRow}>
          <CategoryChip category={item.category} color={item.categoryColor} />
          <View style={styles.spacer} />
          <EnergyBars level={item.energyLevel} />
          <View style={{ width: theme.spacing.sm }} />
          <UrgencyDot urgency={item.urgency} />
        </View>

        <Text style={styles.title}>{item.title}</Text>
        {item.body ? <Text style={styles.body}>{item.body}</Text> : null}

        <Text style={styles.sectionLabel}>Bucket</Text>
        <View style={styles.bucketRow}>
          {BUCKETS.map((b) => (
            <Pressable
              key={b}
              onPress={() => handleBucketChange(b)}
              style={[
                styles.bucketChip,
                displayBucket === b && styles.bucketChipActive,
              ]}
            >
              <Text
                style={[
                  styles.bucketChipText,
                  displayBucket === b && styles.bucketChipTextActive,
                ]}
              >
                {b}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.completeAction,
            completed && styles.actionDisabled,
          ]}
          disabled={completed}
          onPress={handleComplete}
        >
          <Text style={styles.completeActionText}>
            {completed ? 'Completed' : 'Mark complete'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.deleteAction}
          onPress={handleDelete}
          hitSlop={8}
        >
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  back: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
  },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  spacer: { flex: 1 },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    lineHeight: theme.fontSize.xxl * 1.25,
    marginBottom: theme.spacing.md,
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    lineHeight: theme.fontSize.md * 1.5,
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSubtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  bucketRow: { flexDirection: 'row', gap: theme.spacing.sm },
  bucketChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
  },
  bucketChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  bucketChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'capitalize',
  },
  bucketChipTextActive: { color: '#ffffff' },
  actions: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  completeAction: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    backgroundColor: theme.colors.success,
  },
  actionDisabled: { opacity: 0.5 },
  completeActionText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  deleteAction: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  deleteActionText: {
    color: theme.colors.textSubtle,
    fontSize: theme.fontSize.sm,
  },
});
