import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserRole } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

export const useAuth = (): AuthState => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string, userMeta?: any) => {
    console.log(`[Auth] Fetching profile for ${userId}`);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn(`[Auth] Profile fetch failed (${error.code}): ${error.message}`);
        
        // RESILIENCE STRATEGY: 
        // If 406 (Not Acceptable) or PGRST116 (Not Found), implies row doesn't exist or RLS blocked it.
        // We create a "Temporary InMemory Profile" to allow the UI to function (e.g. go to Onboarding).
        // We do NOT block the app.
        
        const fallbackRole = (userMeta?.role || 'owner') as UserRole;
        const fallbackProfile: Profile = {
            id: userId,
            email: userMeta?.email || null,
            full_name: userMeta?.full_name || 'Usuario',
            role: fallbackRole
        };
        
        console.log("[Auth] Using Fallback Profile:", fallbackProfile);
        setProfile(fallbackProfile);
      } else {
        console.log("[Auth] Profile loaded:", data);
        setProfile(data as Profile);
      }
    } catch (err: any) {
      console.error('[Auth] Profile fetch exception:', err);
      // Fallback in case of network crash
      setProfile({ id: userId, email: null, full_name: 'Error User', role: UserRole.OWNER });
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log("[Auth] Initializing...");
        // 1. Get Session (RAM only due to config)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (mounted) {
          if (data.session) {
              console.log("[Auth] Session found");
              setSession(data.session);
              setUser(data.session.user);
              await fetchProfile(data.session.user.id, data.session.user);
          } else {
              console.log("[Auth] No session");
          }
        }
      } catch (err: any) {
        console.error("[Auth] Initialization Failed:", err);
        if (mounted) {
          setError("Error de conexión con el servicio de identidad.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // 2. Listen for changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth] State change: ${event}`);
      if (!mounted) return;
      
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Only fetch if profile is missing or user changed
        if (!profile || profile.id !== newSession.user.id) {
           await fetchProfile(newSession.user.id, newSession.user);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
        console.log("[Auth] Signing out...");
        await supabase.auth.signOut();
    } catch (e) {
        console.warn("Sign out error", e);
    } finally {
        // Force cleanup
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
    }
  };

  return {
    session,
    user,
    profile,
    loading,
    error,
    signOut
  };
};