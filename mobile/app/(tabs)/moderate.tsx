import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { useAuth } from '../../src/hooks/use-auth-session';
import { supabase } from '../../src/lib/supabase';
import type { PendingPost } from '../../src/types';

export default function ModerateScreen() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAuthorized = role === 'admin' || role === 'moderator';

  const pending = useQuery({
    queryKey: ['pending-posts'],
    enabled: isAuthorized,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, category, location_label, description, created_at, user_id, profiles(display_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((post) => ({ ...post, profiles: post.profiles?.[0] ?? null })) as PendingPost[];
    },
  });

  async function decide(id: string, status: 'approved' | 'rejected') {
    setDecidingId(id);
    setErrorMsg(null);
    const { error } = await supabase
      .from('posts')
      .update({
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: user?.id,
      })
      .eq('id', id);
    setDecidingId(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['pending-posts'] });
  }

  if (!isAuthorized) {
    return (
      <ScreenShell title="Moderate">
        <View style={styles.guardCard}>
          <Text style={styles.guardTitle}>Moderators only</Text>
          <Text style={styles.guardText}>You need an admin or moderator role to review posts.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Moderate">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={pending.isRefetching} onRefresh={() => pending.refetch()} />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Pending posts</Text>
          {pending.data && pending.data.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pending.data.length} waiting</Text>
            </View>
          )}
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {pending.isLoading && (
          <View style={styles.loaderRow}>
            <ActivityIndicator color="#2456f5" />
          </View>
        )}

        {pending.isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{(pending.error as Error).message}</Text>
          </View>
        )}

        {!pending.isLoading && pending.data?.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Queue is empty 🎉</Text>
            <Text style={styles.emptyText}>All posts have been reviewed.</Text>
          </View>
        )}

        {pending.data?.map((p) => (
          <View key={p.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{p.category}</Text>
              </View>
              {p.location_label ? <Text style={styles.metaText}>📍 {p.location_label}</Text> : null}
              <Text style={styles.metaText}>· {new Date(p.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.authorText}>
              {p.profiles?.display_name ?? p.profiles?.email ?? 'Unknown'}
            </Text>
            <Text style={styles.bodyText}>{p.description}</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.approveButton, decidingId === p.id && styles.buttonDisabled]}
                onPress={() => decide(p.id, 'approved')}
                disabled={decidingId === p.id}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.rejectButton, decidingId === p.id && styles.buttonDisabled]}
                onPress={() => decide(p.id, 'rejected')}
                disabled={decidingId === p.id}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  countBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  loaderRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  emptyText: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
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
  metaText: {
    color: '#6b7280',
    fontSize: 12,
  },
  authorText: {
    marginTop: 8,
    fontWeight: '700',
    color: '#14213d',
  },
  bodyText: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#2456f5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectButtonText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  guardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  guardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  guardText: {
    marginTop: 6,
    color: '#6b7280',
    textAlign: 'center',
  },
});
