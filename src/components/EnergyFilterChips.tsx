import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '@/state/store';
import { theme } from '@/theme';
import type { EnergyLevel } from '@/types/models';

const LEVELS: { level: EnergyLevel; label: string; dots: string }[] = [
  { level: 1, label: 'Quick win', dots: '●' },
  { level: 2, label: 'Medium', dots: '●●' },
  { level: 3, label: 'Deep focus', dots: '●●●' },
];

/**
 * Row of three toggle chips that filter the Brain screen by energy level.
 * No selection = show everything. Reads/writes selectedEnergyLevels on
 * the app store.
 *
 * Designed for the "what can I do right now?" moment — tap Quick win
 * when you only have 15 minutes of focus left.
 */
export function EnergyFilterChips() {
  const selected = useAppStore((s) => s.selectedEnergyLevels);
  const toggle = useAppStore((s) => s.toggleEnergyLevel);
  const clear = useAppStore((s) => s.setSelectedEnergyLevels);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Energy</Text>
      {LEVELS.map(({ level, label, dots }) => {
        const active = selected.includes(level);
        return (
          <Pressable
            key={level}
            onPress={() => toggle(level)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.dots, active && styles.dotsActive]}>{dots}</Text>
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
      {selected.length > 0 && (
        <Pressable onPress={() => clear([])} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginRight: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  chipActive: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
  },
  dots: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    marginRight: 4,
    letterSpacing: -1,
  },
  dotsActive: { color: theme.colors.accent },
  chipLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
  chipLabelActive: { color: theme.colors.accent },
  clear: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    marginLeft: theme.spacing.xs,
    textDecorationLine: 'underline',
  },
});
