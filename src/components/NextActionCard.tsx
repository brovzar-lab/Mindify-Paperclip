import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNextAction } from '@/hooks/useNextAction';
import { CategoryChip } from './CategoryChip';
import { EnergyBars } from './EnergyBars';
import { theme } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

/**
 * The "one thing" card for the home screen: pulls the single highest-
 * priority, lowest-energy today item and surfaces it front and center
 * so the user has a frictionless runway to start.
 *
 * Absent (renders nothing) if there's no qualifying item.
 */
export function NextActionCard() {
  const nav = useNavigation<ScreenProps<'Home'>['navigation']>();
  const { nextItem } = useNextAction();

  if (!nextItem) return null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => nav.navigate('ItemDetail', { itemId: nextItem.id })}
    >
      <Text style={styles.kicker}>One quick thing</Text>
      <Text style={styles.title} numberOfLines={2}>
        {nextItem.title}
      </Text>
      <View style={styles.meta}>
        <CategoryChip
          category={nextItem.category}
          color={nextItem.categoryColor}
        />
        <View style={styles.spacer} />
        <EnergyBars level={nextItem.energyLevel} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentMuted,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kicker: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
});
