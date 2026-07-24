import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const readConfigValue = (publicName: string, fallback: string, legacyName?: string) => {
  const value = env[publicName] ?? extra[publicName] ?? (legacyName ? extra[legacyName] : undefined) ?? fallback;
  return value?.trim() ? value : fallback;
};

export const SUPABASE_URL = readConfigValue('EXPO_PUBLIC_SUPABASE_URL', 'https://zmjkkasiihycuutikims.supabase.co', 'SUPABASE_URL');
export const SUPABASE_ANON_KEY = readConfigValue(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptamtrYXNpaWh5Y3V1dGlraW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTQ5MTQsImV4cCI6MjA5NzM3MDkxNH0.DGXCQluy5sgQU8-yio0dzjwWrSqenSzGXJzpGJMmG5Y',
  'SUPABASE_ANON_KEY',
);
export const BACKEND_URL = readConfigValue(
  'EXPO_PUBLIC_BACKEND_URL',
  'https://ade93772-c283-47d4-867a-e40418939d7a-00-tfg0zlls6q38.janeway.replit.dev',
  'BACKEND_URL',
);
export const AUTH_REDIRECT_URL = Linking.createURL('/');
export const APP_NAME = 'Campus Pulse';
export const LOCATION_TASK_NAME = 'CAMPUS_PULSE_LOCATION';
export const DEV_ONLY = __DEV__;
