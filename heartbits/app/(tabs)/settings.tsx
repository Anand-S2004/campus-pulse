import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { useAuth } from '../../src/hooks/use-auth-session';
import { requestNotificationPermission } from '../../src/services/notifications';
import { startBackgroundLocationTracking } from '../../src/services/location';

export default function SettingsScreen() {
  const { profile, role, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Check actual OS permission status — SecureStore may be stale if the user
      // granted permission via the OS prompt or device settings after install.
      const [locationPerm, notifPerm, storedNotifications, storedLocation] = await Promise.all([
        Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
        Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
        SecureStore.getItemAsync('cp-notify'),
        SecureStore.getItemAsync('cp-location'),
      ]);

      const notifGranted = notifPerm.status === 'granted';
      const locationGranted = locationPerm.status === 'granted';

      // Sync SecureStore with actual OS state so toggles reflect reality.
      if (notifGranted && storedNotifications !== '1') {
        await SecureStore.setItemAsync('cp-notify', '1');
      }
      if (locationGranted && storedLocation !== '1') {
        await SecureStore.setItemAsync('cp-location', '1');
      }

      setNotificationsEnabled(notifGranted || storedNotifications === '1');
      setLocationEnabled(locationGranted || storedLocation === '1');
    };

    load();
  }, []);

  const updateNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await SecureStore.setItemAsync('cp-notify', value ? '1' : '0');
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotificationsEnabled(false);
        await SecureStore.setItemAsync('cp-notify', '0');
        Alert.alert('Notifications off', 'You can enable them in your device settings.');
      }
    }
  };

  const updateLocation = async (value: boolean) => {
    setLocationEnabled(value);
    await SecureStore.setItemAsync('cp-location', value ? '1' : '0');
    if (value) {
      // Start tracking (not just request permission) so the zone is updated immediately.
      const result = await startBackgroundLocationTracking();
      if (!result.foregroundGranted) {
        setLocationEnabled(false);
        await SecureStore.setItemAsync('cp-location', '0');
        Alert.alert('Location required', 'Grant location permission in your device settings to enable zone tracking.');
      } else if (!result.enabled) {
        // Foreground granted, one-time ping sent — background is optional.
        Alert.alert(
          'Zone updated',
          'Your zone was updated. Enable background location in device settings for continuous tracking.',
        );
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    await AsyncStorage.clear();
    router.replace('/auth');
  };

  return (
    <ScreenShell title="Settings">
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your calm profile</Text>
        <Text style={styles.body}>{profile?.display_name ?? 'Campus friend'}</Text>
        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        ) : null}

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingCaption}>Helpful reminders that respect your attention.</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={updateNotifications} />
        </View>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Location updates</Text>
            <Text style={styles.settingCaption}>Used to keep your campus zone current while preserving privacy.</Text>
          </View>
          <Switch value={locationEnabled} onValueChange={updateLocation} />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Privacy first</Text>
          <Text style={styles.infoText}>Campus Pulse only stores which zone you're in — never your exact coordinates or movement history.</Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/debug')}>
          <Text style={styles.secondaryButtonText}>Developer debug</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => Alert.alert('About Campus Pulse', 'A privacy-first campus positivity platform designed to feel calm and encouraging.')}>
          <Text style={styles.secondaryButtonText}>About Campus Pulse</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={handleLogout}>
          <Text style={styles.ghostButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
  },
  body: {
    color: '#4b5563',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  roleText: {
    color: '#4338ca',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontWeight: '700',
    color: '#14213d',
  },
  settingCaption: {
    color: '#6b7280',
    marginTop: 4,
    maxWidth: 250,
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
  },
  infoTitle: {
    fontWeight: '700',
    color: '#14213d',
  },
  infoText: {
    color: '#4b5563',
    marginTop: 4,
    lineHeight: 20,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  secondaryButtonText: {
    color: '#2456f5',
    fontWeight: '700',
  },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff7ed',
  },
  ghostButtonText: {
    color: '#c2410c',
    fontWeight: '700',
  },
});
