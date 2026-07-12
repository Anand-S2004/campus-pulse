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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBhYmFzZS1yb290LWdvYWwiLCJhcHAiOiJhdXRoLXNlcnZpY2UiLCJleHAiOjM5OTk5OTk5OTl9.zZ1jQX8cQn4lP95f4gq0qg0X5uZ2lD0ySw5D2m2A9L4g',
  'SUPABASE_ANON_KEY',
);
export const BACKEND_URL = readConfigValue(
  'EXPO_PUBLIC_BACKEND_URL',
  'https://15a9513f-c4a6-4db6-b77a-9e999d7106ef-00-10gb4289xv4ip.sisko.replit.dev',
  'BACKEND_URL',
);
export const AUTH_REDIRECT_URL = Linking.createURL('/');
export const APP_NAME = 'Campus Pulse';
export const LOCATION_TASK_NAME = 'CAMPUS_PULSE_LOCATION';
export const DEV_ONLY = __DEV__;
