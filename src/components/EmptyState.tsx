import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },
  body: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    lineHeight: theme.fontSize.sm * 1.5,
  },
});
