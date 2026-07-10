import { Redirect } from 'expo-router';

import { useAuth } from '../src/hooks/use-auth-session';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  return <Redirect href={session ? '/(tabs)' : '/auth'} />;
}
