import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { TopicCard } from '@/components/TopicCard';
import { useTopics } from '@/hooks/useTopics';
import { theme } from '@/theme';
import type { ScreenProps } from '@/navigation/types';

/**
 * Browsable list of the user's persistent topics. Tap a topic to see
 * every item ever assigned to it (across recordings). Empty state
 * explains that topics are created on approval after a recording.
 */
export function TopicsScreen() {
  const nav = useNavigation<ScreenProps<'Topics'>['navigation']>();
  const { topics, loading } = useTopics();

  if (loading && topics.length === 0) {
    return <Loading message="Loading topics..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={16}>
          <Text style={styles.back}>← Brain</Text>
        </Pressable>
        <Text style={styles.title}>Topics</Text>
        <View style={{ width: 60 }} />
      </View>

      {topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          body="After a recording, Mindify will ask if you want to cluster related items into a topic. Approve one and it will live here."
        />
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TopicCard
              topic={item}
              onPress={() =>
                nav.navigate('TopicDetail', { topicId: item.id })
              }
            />
          )}
          contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  back: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
});
