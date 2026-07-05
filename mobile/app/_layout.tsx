import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '../src/providers/AppProviders';
import { startBackgroundLocationTracking } from '../src/services/location';
import { registerForPushNotifications } from '../src/services/notifications';

export default function RootLayout() {
  useEffect(() => {
    startBackgroundLocationTracking().catch(() => undefined);
    registerForPushNotifications().catch(() => undefined);
  }, []);

  return (
    <>
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
      <StatusBar style="dark" />
    </>
  );
}
