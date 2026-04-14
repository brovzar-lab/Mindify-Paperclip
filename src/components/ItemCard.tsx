import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import {
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { theme } from '@/theme';
import type { Bucket, ItemDoc } from '@/types/models';
import { CategoryChip } from './CategoryChip';
import { EnergyBars } from './EnergyBars';
import { UrgencyDot } from './UrgencyDot';

const NEXT_BUCKET: Record<Bucket, Bucket | null> = {
  today: 'tomorrow',
  tomorrow: 'someday',
  someday: null,
};

const TYPE_ICON: Record<ItemDoc['type'], string> = {
  task: '✓',
  idea: '✦',
  project: '◇',
};

/**
 * One row in The Brain. Tap → detail screen. Long-press → mark complete.
 * Swipe right → snooze (advance bucket today→tomorrow→someday).
 *
 * Firestore rules only permit the client to mutate completedAt and bucket
 * on items it owns; both interactions match.
 */
export function ItemCard({
  item,
  onPress,
}: {
  item: ItemDoc;
  onPress?: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  async function handleComplete() {
    await updateDoc(doc(db, 'items', item.id), {
      completedAt: serverTimestamp(),
    });
  }

  async function handleSnooze() {
    const next = NEXT_BUCKET[item.bucket];
    if (next) {
      await updateDoc(doc(db, 'items', item.id), { bucket: next });
    }
    swipeRef.current?.close();
  }

  function renderRightActions(
    progress: Animated.AnimatedInterpolation<number>,
  ) {
    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    });
    const next = NEXT_BUCKET[item.bucket];
    return (
      <RectButton style={styles.snoozeAction} onPress={handleSnooze}>
        <Animated.Text style={[styles.snoozeText, { opacity }]}>
          {next ? `→ ${next}` : 'someday'}
        </Animated.Text>
      </RectButton>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <Pressable
        onPress={onPress}
        onLongPress={handleComplete}
        style={styles.card}
      >
        <View style={styles.row}>
          <Text style={styles.typeIcon}>{TYPE_ICON[item.type]}</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <CategoryChip
                category={item.category}
                color={item.categoryColor}
              />
              <View style={styles.spacer} />
              <EnergyBars level={item.energyLevel} />
              <View style={{ width: theme.spacing.sm }} />
              <UrgencyDot urgency={item.urgency} />
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginVertical: 4,
    marginHorizontal: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  typeIcon: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.accent,
    width: 24,
    textAlign: 'center',
  },
  body: { flex: 1 },
  title: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  snoozeAction: {
    backgroundColor: theme.colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    marginVertical: 4,
    marginRight: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  snoozeText: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
});
