
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserRole, UserSession } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null; // Supabase User object
  profile: Profile | null; // Extended Profile data
  shadowUser: UserSession | null; // Custom User for Managers/Operators/Auditors
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  signInShadow: (user: UserSession) => void;
}

export const useAuth = (): AuthState => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shadowUser, setShadowUser] = useState<UserSession | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resilient Profile Fetcher
   * Fetches DB profile or falls back to JWT metadata.
   * NEVER throws.
   */
  const fetchProfile = async (userId: string, authUser: User) => {
    try {
      // 1. Attempt DB Fetch (Optimistic)
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Catch Schema Errors specifically (PGRST500)
      if (dbError) {
        if (dbError.message?.includes('schema') || dbError.code === 'PGRST500') {
           console.warn('[Auth] DB Schema Error detected. Switching to Metadata Profile.');
        }
        throw dbError; // Throw to trigger fallback
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        throw new Error('Profile missing');
      }

    } catch (err: any) {
      // 2. FALLBACK STRATEGY (Metadata)
      // This ensures we never block access due to DB issues
      
      const meta = authUser.user_metadata || {};
      let fallbackRole = UserRole.OWNER;
      let fallbackName = meta.full_name || authUser.email?.split('@')[0] || 'Usuario';

      // Emergency Superadmin Override
      if (authUser.email === 'admin@admin.com') {
         fallbackRole = UserRole.SUPERADMIN;
         fallbackName = 'SuperAdmin';
      } else if (meta.role) {
         fallbackRole = meta.role;
      }

      setProfile({
          id: userId,
          email: authUser.email || null,
          full_name: fallbackName,
          role: fallbackRole
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Try Supabase Auth
        // We wrap this in a try/catch to handle 500 errors from the Auth Server
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[Auth] Session Error:', sessionError.message);
          // If 500 error or similar connection issue, clear storage to prevent loops
          if (sessionError.status === 500 || sessionError.message.includes('fetch')) {
             await supabase.auth.signOut().catch(() => {});
          }
          throw sessionError;
        }

        if (mounted) {
          if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              // Fire and forget profile fetch (updates state when ready)
              fetchProfile(data.session.user.id, data.session.user);
          } else {
              // 2. Check for Shadow Session
              const storedShadow = sessionStorage.getItem('garage_shadow_user');
              if (storedShadow) {
                try {
                  const parsed = JSON.parse(storedShadow);
                  setShadowUser(parsed);
                  setProfile({
                    id: parsed.id,
                    email: null,
                    full_name: parsed.full_name,
                    role: parsed.role as UserRole
                  });
                } catch (e) {
                  console.warn('Invalid shadow session');
                }
              }
          }
        }
      } catch (err: any) {
        console.error("Auth Init Failed:", err.message);
        // Do not set global error to prevent locking the user out of Login Screen
        if (mounted) {
           setSession(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setShadowUser(null);
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setShadowUser(null);
        fetchProfile(newSession.user.id, newSession.user);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInShadow = (sUser: UserSession) => {
    setShadowUser(sUser);
    setProfile({
      id: sUser.id,
      email: null,
      full_name: sUser.full_name,
      role: sUser.role
    });
    try { sessionStorage.setItem('garage_shadow_user', JSON.stringify(sUser)); } catch (e) {}
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    try {
        await supabase.auth.signOut();
        try { sessionStorage.removeItem('garage_shadow_user'); } catch (e) {}
    } catch (err) {
      console.error('SignOut error:', err);
    } finally {
        setSession(null);
        setUser(null);
        setProfile(null);
        setShadowUser(null);
        setLoading(false);
    }
  };

  return {
    session,
    user,
    profile,
    shadowUser,
    loading,
    error,
    signOut,
    signInShadow
  };
};
