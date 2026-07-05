import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenShell } from '../../src/components/ScreenShell';
import { useAuth } from '../../src/hooks/use-auth-session';
import { requestNotificationPermission } from '../../src/services/notifications';
import { requestLocationPermissions } from '../../src/services/location';

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      const storedNotifications = await SecureStore.getItemAsync('cp-notify');
      const storedLocation = await SecureStore.getItemAsync('cp-location');
      setNotificationsEnabled(storedNotifications === '1');
      setLocationEnabled(storedLocation === '1');
    };

    load();
  }, []);

  const updateNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await SecureStore.setItemAsync('cp-notify', value ? '1' : '0');
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications will stay off', 'You can enable them later in your device settings.');
      }
    }
  };

  const updateLocation = async (value: boolean) => {
    setLocationEnabled(value);
    await SecureStore.setItemAsync('cp-location', value ? '1' : '0');
    if (value) {
      const permissions = await requestLocationPermissions();
      if (!permissions.enabled) {
        Alert.alert('Location is still off', 'Campus Pulse will keep working without background location.');
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
          <Text style={styles.infoText}>Campus Pulse only sends your location to the backend. The app never shows your exact coordinates or movement history.</Text>
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
