import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const readConfigValue = (publicName: string, fallback: string, legacyName?: string) => {
  const value = env[publicName] ?? extra[publicName] ?? (legacyName ? extra[legacyName] : undefined) ?? fallback;
  return value?.trim() ? value : fallback;
};

export const SUPABASE_URL = readConfigValue('EXPO_PUBLIC_SUPABASE_URL', 'https://mtqyrbyudtduyoqtumlt.supabase.co', 'SUPABASE_URL');
export const SUPABASE_ANON_KEY = readConfigValue(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cXlyYnl1ZHRkdXlvcXR1bWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTA3MzAsImV4cCI6MjA5NzE2NjczMH0.2IztZH7Qif4VKYwTgxVRup0Q2HtRb8HlcHeyJ_aHVA8',
  'SUPABASE_ANON_KEY',
);
export const BACKEND_URL = readConfigValue(
  'EXPO_PUBLIC_BACKEND_URL',
  'https://6b387340-0efc-40fb-aafc-c46708c89e03-00-1327hnc5xtsxn.pike.replit.dev',
  'BACKEND_URL',
);
export const AUTH_REDIRECT_URL = Linking.createURL('/');
export const APP_NAME = 'Campus Pulse';
export const LOCATION_TASK_NAME = 'CAMPUS_PULSE_LOCATION';
export const DEV_ONLY = __DEV__;
