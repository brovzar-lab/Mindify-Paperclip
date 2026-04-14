import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

/** Pill chip whose color comes from the item's classifier-assigned hex. */
export function CategoryChip({
  category,
  color,
}: {
  category: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: `${color}33`, borderColor: color },
      ]}
    >
      <Text style={[styles.text, { color: theme.colors.text }]}>
        {category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.5,
  },
});
