import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import type { TopicDoc } from '@/types/models';

/**
 * One row in the Topics screen. Shows topic name + item count, tap
 * opens the TopicDetail list.
 */
export function TopicCard({
  topic,
  onPress,
}: {
  topic: TopicDoc;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {topic.name}
        </Text>
        <Text style={styles.count}>
          {topic.itemCount} item{topic.itemCount === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  body: { flex: 1 },
  name: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  count: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  chev: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSubtle,
  },
});
