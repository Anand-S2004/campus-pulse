import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PostItem } from '../types';

interface PostCardProps {
  item: PostItem;
  onToggleReaction: (postId: string) => Promise<void>;
  reactionBusy: boolean;
}

export function PostCard({ item, onToggleReaction, reactionBusy }: PostCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.author}>{item.authorName}</Text>
          <Text style={styles.meta}>{item.location_label}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.category}</Text>
        </View>
      </View>

      <Text style={styles.body}>{item.description}</Text>

      {item.photo_url ? (
        <Image
          source={{ uri: item.photo_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <Pressable onPress={() => onToggleReaction(item.id)} style={styles.reactionButton}>
          {reactionBusy ? (
            <ActivityIndicator size="small" color="#2456f5" />
          ) : (
            <Text style={styles.reactionText}>
              {item.userReacted ? '💛' : '🤍'} {item.reactionCount}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#2456f5',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
    marginTop: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timestamp: {
    color: '#6b7280',
    fontSize: 12,
  },
  reactionButton: {
    backgroundColor: '#f5f9ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reactionText: {
    color: '#2456f5',
    fontWeight: '600',
  },
});
