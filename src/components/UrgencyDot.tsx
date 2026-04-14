import { StyleSheet, View } from 'react-native';
import { theme } from '@/theme';
import type { Urgency } from '@/types/models';

const COLOR: Record<Urgency, string> = {
  high: theme.colors.urgencyHigh,
  medium: theme.colors.urgencyMed,
  low: theme.colors.urgencyLow,
};

export function UrgencyDot({ urgency }: { urgency: Urgency }) {
  return <View style={[styles.dot, { backgroundColor: COLOR[urgency] }]} />;
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
});
