import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '../src/components/ScreenShell';
import { useAuth } from '../src/hooks/use-auth-session';
import { checkBackendHealth } from '../src/lib/api';
import { getLocationPermissionStatus } from '../src/services/location';
import { getNotificationPermissionStatus } from '../src/services/notifications';

export default function DebugScreen() {
  const { user, profile, session } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState('checking');
  const [locationStatus, setLocationStatus] = useState('checking');
  const [backendStatus, setBackendStatus] = useState<{ reachable: boolean; latency: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const notification = await getNotificationPermissionStatus();
      const location = await getLocationPermissionStatus();
      const backend = await checkBackendHealth();
      setNotificationStatus(notification);
      setLocationStatus(location);
      setBackendStatus(backend);
      setLoading(false);
    };

    run();
  }, []);

  return (
    <ScreenShell title="Developer debug">
      <View style={styles.card}>
        {loading ? <ActivityIndicator size="small" color="#2456f5" /> : null}
        <View style={styles.row}><Text style={styles.label}>Session</Text><Text style={styles.value}>{session ? 'active' : 'none'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>User ID</Text><Text style={styles.value}>{user?.id ?? 'n/a'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Notification permission</Text><Text style={styles.value}>{notificationStatus}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Location permission</Text><Text style={styles.value}>{locationStatus}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Background task status</Text><Text style={styles.value}>ready</Text></View>
        <View style={styles.row}><Text style={styles.label}>Foreground task status</Text><Text style={styles.value}>ready</Text></View>
        <View style={styles.row}><Text style={styles.label}>Current resolved zone</Text><Text style={styles.value}>Campus community</Text></View>
        <View style={styles.row}><Text style={styles.label}>Last upload timestamp</Text><Text style={styles.value}>Pending</Text></View>
        <View style={styles.row}><Text style={styles.label}>Expo push token</Text><Text style={styles.value}>Not registered yet</Text></View>
        <View style={styles.row}><Text style={styles.label}>Backend connectivity</Text><Text style={styles.value}>{backendStatus ? (backendStatus.reachable ? 'online' : 'offline') : 'checking'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>API latency</Text><Text style={styles.value}>{backendStatus ? `${backendStatus.latency} ms` : 'checking'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Profile</Text><Text style={styles.value}>{profile?.display_name ?? 'n/a'}</Text></View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: '#6b7280',
    fontSize: 13,
    flex: 1,
  },
  value: {
    color: '#14213d',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
});
