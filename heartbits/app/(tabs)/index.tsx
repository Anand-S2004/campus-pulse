import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { PostCard } from '../../src/components/PostCard';
import { ScreenShell } from '../../src/components/ScreenShell';
import { fetchFeedPage, togglePostReaction } from '../../src/lib/api';
import { sendCurrentLocationOnce } from '../../src/services/location';

export default function FeedScreen() {
  const queryClient = useQueryClient();
  const [reactionBusyId, setReactionBusyId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isFetching, isRefetching } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length : undefined),
  });

  useEffect(() => {
    sendCurrentLocationOnce().catch(() => undefined);
  }, []);

  const toggleReaction = useMutation({
    mutationFn: async (postId: string) => {
      setReactionBusyId(postId);
      return togglePostReaction(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onSettled: () => setReactionBusyId(null),
  });

  const posts = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const pulseCards = useMemo(() => data?.pages[0]?.pulseCards ?? [], [data]);

  return (
    <ScreenShell title="Campus Pulse" actionLabel="Share" onActionPress={() => router.push('/(tabs)/create')}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching && isRefetching} onRefresh={() => refetch()} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Positive moments, shared gently.</Text>
            <Text style={styles.heroCopy}>The feed highlights calm, encouraging campus experiences without pressure or comparison.</Text>
            <View style={styles.pulseWrap}>
              {pulseCards.length ? (
                pulseCards.map((card) => (
                  <View key={card.id} style={styles.pulseCard}>
                    <Text style={styles.pulseText}>{card.body}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.pulseText}>Your school's community pulse is still warming up.</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>The feed is quiet right now.</Text>
            <Text style={styles.emptyCopy}>Start with a small, hopeful moment to help the community feel more visible.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onToggleReaction={async (postId) => {
              await toggleReaction.mutateAsync(postId);
            }}
            reactionBusy={reactionBusyId === item.id}
          />
        )}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color="#2456f5" />
            </View>
          ) : null
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#eef5ff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#14213d',
  },
  heroCopy: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#4b5563',
  },
  pulseWrap: {
    marginTop: 12,
    gap: 8,
  },
  pulseCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
  },
  pulseText: {
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#14213d',
  },
  emptyCopy: {
    marginTop: 6,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
  },
  loaderRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
