import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';
import type { EnergyLevel } from '@/types/models';

/** Three escalating bars; filled count = energy level (1-3). */
export function EnergyBars({ level }: { level: EnergyLevel }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.bar,
            {
              backgroundColor:
                n <= level ? theme.colors.accent : theme.colors.divider,
              height: 6 + n * 4,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 5, borderRadius: 2 },
});
