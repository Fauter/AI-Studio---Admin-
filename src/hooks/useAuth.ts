import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserRole, UserSession } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null; // Supabase User
  profile: Profile | null;
  shadowUser: UserSession | null; // Custom User for Managers/Operators
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

  const fetchProfile = async (userId: string, userMeta?: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Fallback for missing profiles
        const fallbackRole = (userMeta?.role || 'owner') as UserRole;
        setProfile({
            id: userId,
            email: userMeta?.email || null,
            full_name: userMeta?.full_name || 'Usuario',
            role: fallbackRole
        });
      } else {
        setProfile(data as Profile);
      }
    } catch (err: any) {
      console.error('[Auth] Profile fetch exception:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Try Supabase Auth (Standard)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (mounted) {
          if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
              await fetchProfile(data.session.user.id, data.session.user);
          } else {
              // 2. Check for Shadow Session (In Memory/Local for this session)
              // Since persistence is off in lib/supabase, we rely on App state passed down, 
              // or effectively the user is logged out on refresh (Desired security behavior).
              // To persist shadow users across refresh in a real app, we'd use sessionStorage here.
              const storedShadow = sessionStorage.getItem('garage_shadow_user');
              if (storedShadow) {
                const parsed = JSON.parse(storedShadow);
                setShadowUser(parsed);
                // Map shadow user to Profile interface for compatibility
                setProfile({
                  id: parsed.id,
                  email: null,
                  full_name: parsed.full_name,
                  role: parsed.role
                });
              }
          }
        }
      } catch (err: any) {
        if (mounted) setError("Error de conexión.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setShadowUser(null); // Clear shadow if real auth happens
        sessionStorage.removeItem('garage_shadow_user');
        if (!profile || profile.id !== newSession.user.id) {
           await fetchProfile(newSession.user.id, newSession.user);
        }
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
    sessionStorage.setItem('garage_shadow_user', JSON.stringify(sUser));
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    try {
        await supabase.auth.signOut();
        sessionStorage.removeItem('garage_shadow_user');
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