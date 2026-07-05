import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenShell } from '../src/components/ScreenShell';
import { useAuth } from '../src/hooks/use-auth-session';

export default function AuthScreen() {
  const { signIn, signUp, session, loading } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace('/(tabs)');
    }
  }, [loading, session]);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Please enter your details.');
      return;
    }

    try {
      setBusy(true);
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        if (!displayName.trim()) {
          Alert.alert('Add a friendly display name to continue.');
          return;
        }
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (error) {
      Alert.alert('Authentication issue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell title={mode === 'signIn' ? 'Welcome back' : 'Create your account'}>
      <View style={styles.card}>
        <Text style={styles.copy}>A calm, privacy-first way to share campus kindness.</Text>

        {mode === 'signUp' ? (
          <TextInput
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            autoCapitalize="words"
          />
        ) : null}

        <TextInput
          placeholder="Campus email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />

        <Pressable style={styles.primaryButton} onPress={onSubmit}>
          <Text style={styles.primaryButtonText}>{busy ? 'Working…' : mode === 'signIn' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchText}>{mode === 'signIn' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  copy: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#2456f5',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  switchText: {
    color: '#2456f5',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
});
