
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserRole, UserSession } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null; // Supabase User object (Identity)
  profile: Profile | null; // App Domain Profile
  shadowUser: UserSession | null; // Employee Session Data
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  signInShadow: (userData: UserSession) => void;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

// --- Helper: Fetch Standard Profile from DB ---
const _fetchDbProfile = async (userId: string, authUser: User): Promise<Profile> => {
  const { data, error: dbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (dbError && dbError.code !== 'PGRST116') {
    console.warn('[Auth] DB Profile Fetch Warning:', dbError.message);
  }

  if (data) return data as Profile;

  // Fallback Metadata Strategy
  const meta = authUser.user_metadata || {};
  return {
    id: userId,
    email: authUser.email || null,
    full_name: meta.full_name || 'Usuario',
    role: (meta.role as UserRole) || UserRole.OWNER
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shadowUser, setShadowUser] = useState<UserSession | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const profileRef = useRef<Profile | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Only show the global loader on TRUE cold boot, never on tab re-focus
        if (!isInitializedRef.current) setLoading(true);

        // 1. Check Standard Session (Supabase Auth)
        const { data: { session: sbSession }, error: sbError } = await supabase.auth.getSession();
        if (sbError) throw sbError;

        if (sbSession) {
          if (mounted) {
            // Set preliminary profile from metadata FIRST so Dashboard responds instantly
            setProfile({
              id: sbSession.user.id,
              email: sbSession.user.email || null,
              full_name: sbSession.user.user_metadata?.full_name || 'Usuario',
              role: (sbSession.user.user_metadata?.role as UserRole) || UserRole.OWNER
            });

            setSession(sbSession);
            setUser(sbSession.user);

            // Fetch real DB profile asynchronously
            _fetchDbProfile(sbSession.user.id, sbSession.user)
              .then(userProfile => {
                if (mounted) setProfile(userProfile);
              })
              .catch(e => console.warn('[Auth] Async DB Profile Fetch Error:', e));
          }
        } else {
          // 2. Check Shadow Session (SessionStorage)
          const storedShadow = sessionStorage.getItem('garage_shadow_user');
          if (storedShadow) {
            try {
              const parsed: UserSession = JSON.parse(storedShadow);
              if (mounted) {
                setShadowUser(parsed);
                // Construct Profile from Session Data (NO DB CALL)
                setProfile({
                  id: parsed.id,
                  email: null,
                  full_name: parsed.full_name,
                  role: parsed.role
                });
              }
            } catch (e) {
              console.warn('[Auth] Invalid shadow session, clearing.');
              sessionStorage.removeItem('garage_shadow_user');
            }
          }
        }
      } catch (err: any) {
        console.error("[Auth] Init Failed:", err.message);
        if (mounted) {
          setSession(null);
          setShadowUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          isInitializedRef.current = true;
        }
      }
    };

    initAuth();

    // Listener for Standard Auth Changes
    // CRITICAL: After initialization, ALL events are handled SILENTLY (no loading state)
    // to prevent the re-hydration loop on tab visibility change.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // --- SIGN OUT: Always reset everything ---
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setShadowUser(null);
        isInitializedRef.current = false; // Allow cold-boot loader on next login
        setLoading(false);
        return;
      }

      // --- TOKEN_REFRESHED: Silent in-place update (tab re-focus, background refresh) ---
      if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
        // Profile stays as-is — no need to refetch on token refresh
        return;
      }

      // --- SIGNED_IN ---
      if (event === 'SIGNED_IN' && newSession) {
        // If already initialized, this is a re-auth from tab wake-up → silent update
        if (isInitializedRef.current) {
          setSession(newSession);
          setUser(newSession.user);
          setProfile(prev => prev || {
            id: newSession.user.id,
            email: newSession.user.email || null,
            full_name: newSession.user.user_metadata?.full_name || 'Usuario',
            role: (newSession.user.user_metadata?.role as UserRole) || UserRole.OWNER
          });
          // Silent background profile refresh (no loading)
          _fetchDbProfile(newSession.user.id, newSession.user)
            .then(userProfile => { if (mounted) setProfile(userProfile); })
            .catch(e => console.warn('[Auth] Async DB Profile Fetch Error:', e));
          return;
        }

        // TRUE first sign-in (cold boot): show loader briefly
        setLoading(true);

        // Optimistic profile first
        setProfile(prev => prev || {
          id: newSession.user.id,
          email: newSession.user.email || null,
          full_name: newSession.user.user_metadata?.full_name || 'Usuario',
          role: (newSession.user.user_metadata?.role as UserRole) || UserRole.OWNER
        });

        setSession(newSession);
        setUser(newSession.user);
        setShadowUser(null);
        sessionStorage.removeItem('garage_shadow_user');

        setLoading(false);
        isInitializedRef.current = true;

        _fetchDbProfile(newSession.user.id, newSession.user)
          .then(userProfile => { if (mounted) setProfile(userProfile); })
          .catch(e => console.warn('[Auth] Async DB Profile Fetch Error:', e));
        return;
      }

      // --- FALLBACK: Any other event with a session (INITIAL_SESSION, USER_UPDATED, etc.) ---
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setProfile(prev => prev || {
          id: newSession.user.id,
          email: newSession.user.email || null,
          full_name: newSession.user.user_metadata?.full_name || 'Usuario',
          role: (newSession.user.user_metadata?.role as UserRole) || UserRole.OWNER
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInShadow = (sUser: UserSession) => {
    // LOGIN ATÓMICO: Actualización síncrona de estado global
    setLoading(true);

    // 1. Persistencia
    try {
      sessionStorage.setItem('garage_shadow_user', JSON.stringify(sUser));
    } catch (e) {
      console.error("Storage Error", e);
    }

    // 2. Limpieza de estado anterior
    setSession(null);
    setUser(null);

    // 3. Inyección de nuevo estado
    setShadowUser(sUser);
    setProfile({
      id: sUser.id,
      email: null,
      full_name: sUser.full_name,
      role: sUser.role
    });

    // 4. Liberación (Dispara re-render en consumidores)
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    try {
      try { sessionStorage.removeItem('garage_shadow_user'); } catch (e) { }
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-')) localStorage.removeItem(key);
        }
      } catch (e) { }

      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SignOut Timeout')), 3000))
      ]);
    } catch (err) {
      console.warn('SignOut error or timeout:', err);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setShadowUser(null);
      setLoading(false);
    }
  };

  const value: AuthState = {
    session,
    user,
    profile,
    shadowUser,
    loading,
    error,
    signOut,
    signInShadow
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
