import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile } from '../api/profiles';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  profileError: Error | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    // Первое событие (INITIAL_SESSION) приходит сразу с сохранённой сессией или null.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsSessionLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    // Данные прошлого пользователя не должны мелькнуть у следующего.
    queryClient.clear();
  };

  const value: AuthContextValue = {
    session,
    profile: profileQuery.data ?? null,
    isLoading: isSessionLoading || (Boolean(userId) && profileQuery.isPending),
    profileError: profileQuery.error,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth используется вне AuthProvider');
  }
  return context;
}

// Профиль текущего пользователя на страницах за RequireAuth — там он уже загружен.
export function useCurrentProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) {
    throw new Error('useCurrentProfile используется вне защищённого маршрута');
  }
  return profile;
}
