import { Tabs } from 'expo-router';

import { useAuth } from '../../src/hooks/use-auth-session';

export default function TabsLayout() {
  const { role } = useAuth();
  const isModerator = role === 'admin' || role === 'moderator';
  const isAdmin = role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2456f5',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#eef2ff',
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarLabel: 'Feed' }} />
      <Tabs.Screen name="create" options={{ title: 'Share', tabBarLabel: 'Share' }} />
      {isModerator && <Tabs.Screen name="moderate" options={{ title: 'Moderate', tabBarLabel: 'Moderate' }} />}
      {isAdmin && <Tabs.Screen name="zones" options={{ title: 'Zones', tabBarLabel: 'Zones' }} />}
      <Tabs.Screen name="recap" options={{ title: 'Recap', tabBarLabel: 'Recap' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
