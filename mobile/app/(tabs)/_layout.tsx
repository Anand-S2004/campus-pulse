import { Tabs } from 'expo-router';

export default function TabsLayout() {
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
      <Tabs.Screen name="recap" options={{ title: 'Recap', tabBarLabel: 'Recap' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
