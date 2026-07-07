import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { useAuth } from '../../src/hooks/use-auth-session';
import { supabase } from '../../src/lib/supabase';
import type { CampusZone } from '../../src/types';

export default function ZonesScreen() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === 'admin';
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    short_code: '',
    center_lat: '',
    center_lon: '',
    radius_m: '80',
  });

  const zones = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campus_zones')
        .select('id, name, short_code, center_lat, center_lon, radius_m')
        .order('name');
      if (error) throw error;
      return (data ?? []) as CampusZone[];
    },
  });

  const occupancy = useQuery({
    queryKey: ['zone-occupancy'],
    enabled: isAdmin,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('location_events')
        .select('zone_id, user_id')
        .gte('occurred_at', thirtyMinAgo);
      if (error) throw error;
      const byZone = new Map<string, Set<string>>();
      for (const ev of data ?? []) {
        if (!byZone.has(ev.zone_id)) byZone.set(ev.zone_id, new Set());
        byZone.get(ev.zone_id)!.add(ev.user_id);
      }
      return Object.fromEntries([...byZone.entries()].map(([k, v]) => [k, v.size])) as Record<string, number>;
    },
  });

  async function createZone() {
    setErrorMsg(null);
    setBusy(true);
    const { error } = await supabase.from('campus_zones').insert({
      name: form.name,
      short_code: form.short_code || null,
      center_lat: Number(form.center_lat),
      center_lon: Number(form.center_lon),
      radius_m: Number(form.radius_m),
    });
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setForm({ name: '', short_code: '', center_lat: '', center_lon: '', radius_m: '80' });
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['campus-zones'] });
  }

  async function removeZone(id: string, zoneName: string) {
    setErrorMsg(null);
    const { error } = await supabase.from('campus_zones').delete().eq('id', id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['campus-zones'] });
  }

  if (!isAdmin) {
    return (
      <ScreenShell title="Zones">
        <View style={styles.guardCard}>
          <Text style={styles.guardTitle}>Admins only</Text>
          <Text style={styles.guardText}>You need an admin role to manage campus zones.</Text>
        </View>
      </ScreenShell>
    );
  }

  const totalOccupied = occupancy.data ? Object.values(occupancy.data).reduce((a, b) => a + b, 0) : 0;

  return (
    <ScreenShell title="Zones">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Who's Here Now */}
        <View style={styles.occupancyCard}>
          <View style={styles.occupancyHeader}>
            <Text style={styles.occupancyTitle}>Who's Here Now</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalOccupied} in 30m</Text>
            </View>
          </View>
          <Text style={styles.occupancyCaption}>Unique users per zone in the last 30 minutes.</Text>

          {occupancy.isLoading && <ActivityIndicator color="#2456f5" style={styles.loaderRow} />}
          {occupancy.isError && (
            <Text style={styles.errorText}>Could not load occupancy. Make sure the location admin policy is enabled.</Text>
          )}

          {zones.data?.map((z) => {
            const count = occupancy.data?.[z.id] ?? 0;
            return (
              <View key={z.id} style={[styles.occupancyRow, count > 0 && styles.occupancyRowActive]}>
                <Text style={styles.occupancyName}>{z.name}</Text>
                <Text style={styles.occupancyCount}>
                  {count} {count === 1 ? 'person' : 'people'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Add Zone */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add zone</Text>
          <TextInput
            style={styles.input}
            placeholder="Name (e.g. Library)"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Short code (e.g. LIB)"
            value={form.short_code}
            onChangeText={(text) => setForm({ ...form, short_code: text })}
          />
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Latitude"
              keyboardType="numeric"
              value={form.center_lat}
              onChangeText={(text) => setForm({ ...form, center_lat: text })}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Longitude"
              keyboardType="numeric"
              value={form.center_lon}
              onChangeText={(text) => setForm({ ...form, center_lon: text })}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Radius in meters"
            keyboardType="numeric"
            value={form.radius_m}
            onChangeText={(text) => setForm({ ...form, radius_m: text })}
          />
          <Pressable
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={createZone}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Adding…' : 'Add zone'}</Text>
          </Pressable>
        </View>

        {/* Zone List */}
        <View style={styles.listSection}>
          <Text style={styles.formTitle}>Campus zones</Text>
          {zones.isLoading && <ActivityIndicator color="#2456f5" style={styles.loaderRow} />}
          {zones.data?.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No zones yet.</Text>
            </View>
          )}
          {zones.data?.map((z) => (
            <View key={z.id} style={styles.zoneRow}>
              <View>
                <Text style={styles.zoneName}>
                  {z.name} {z.short_code ? <Text style={styles.zoneCode}>({z.short_code})</Text> : null}
                </Text>
                <Text style={styles.zoneMeta}>
                  {z.center_lat.toFixed(5)}, {z.center_lon.toFixed(5)} · {z.radius_m} m
                </Text>
              </View>
              <Pressable style={styles.deleteButton} onPress={() => removeZone(z.id, z.name)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
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
  loaderRow: {
    paddingVertical: 12,
  },
  occupancyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  occupancyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  occupancyCaption: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 12,
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
  occupancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  occupancyRowActive: {
    backgroundColor: '#f0f9ff',
  },
  occupancyName: {
    fontWeight: '600',
    color: '#14213d',
  },
  occupancyCount: {
    color: '#2456f5',
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#1f2937',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#2456f5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  listSection: {
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
  },
  zoneRow: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  zoneName: {
    fontWeight: '700',
    color: '#14213d',
  },
  zoneCode: {
    fontWeight: '400',
    color: '#6b7280',
  },
  zoneMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
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
