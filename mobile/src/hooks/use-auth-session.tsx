import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { BACKEND_URL } from '../lib/config';
import { supabase } from '../lib/supabase';

type ProfileData = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (!active) {
        return;
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    };

    hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('id, display_name, email').eq('id', user.id).maybeSingle();
      if (!error) {
        setProfile(data as ProfileData | null);
      }
    };

    refreshProfile();
  }, [user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (!data.session) {
      throw new Error('Unable to restore your session.');
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const response = await fetch(`${BACKEND_URL}/api/public/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unable to create the account.' }));
      throw new Error(body.error ?? 'Unable to create the account.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (!data.session) {
      throw new Error('Unable to restore your session.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, user, profile, loading, signIn, signUp, signOut }),
    [loading, profile, session, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
