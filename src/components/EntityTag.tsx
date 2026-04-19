import { StyleSheet, Text } from 'react-native';
import { theme } from '@/theme';

/**
 * Inline relationship chip appended to names the app has learned about
 * ("Alex (daughter)"). Intentionally subtle — it's a hint, not a label.
 */
export function EntityTag({ relationship }: { relationship: string }) {
  return <Text style={styles.tag}> ({relationship})</Text>;
}

const styles = StyleSheet.create({
  tag: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    fontWeight: theme.fontWeight.regular,
  },
});
