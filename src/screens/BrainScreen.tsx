import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ItemCard } from '@/components/ItemCard';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { useItems } from '@/hooks/useItems';
import { theme } from '@/theme';
import type { Bucket, ItemDoc } from '@/types/models';
import type { ScreenProps } from '@/navigation/types';

const URGENCY_RANK: Record<ItemDoc['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const BUCKET_ORDER: Bucket[] = ['today', 'tomorrow', 'someday'];
const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  someday: 'Someday',
};

export function BrainScreen() {
  const nav = useNavigation<ScreenProps<'Brain'>['navigation']>();
  const { items, loading } = useItems();

  if (loading && items.length === 0) {
    return <Loading message="Loading your brain..." />;
  }

  const sections = BUCKET_ORDER.map((bucket) => ({
    title: BUCKET_LABEL[bucket],
    data: items
      .filter((i) => i.bucket === bucket)
      .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]),
  })).filter((s) => s.data.length > 0);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={16}>
          <Text style={styles.back}>← Home</Text>
        </Pressable>
        <Text style={styles.title}>The Brain</Text>
        <View style={{ width: 60 }} />
      </View>

      {sections.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Tap the record button on home and speak your mind."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() =>
                nav.navigate('ItemDetail', { itemId: item.id })
              }
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>
                {section.data.length}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeaderText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionHeaderCount: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSubtle,
  },
});
