
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        setLoading(true);
        
        // 1. Check Standard Session (Supabase Auth)
        const { data: { session: sbSession }, error: sbError } = await supabase.auth.getSession();
        if (sbError) throw sbError;

        if (sbSession) {
          if (mounted) {
            setSession(sbSession);
            setUser(sbSession.user);
            const userProfile = await _fetchDbProfile(sbSession.user.id, sbSession.user);
            setProfile(userProfile);
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
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listener for Standard Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setShadowUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' && newSession) {
         setLoading(true);
         setSession(newSession);
         setUser(newSession.user);
         setShadowUser(null); 
         sessionStorage.removeItem('garage_shadow_user');
         
         const userProfile = await _fetchDbProfile(newSession.user.id, newSession.user);
         setProfile(userProfile);
         setLoading(false);
      } else if (newSession) {
         setSession(newSession);
         setUser(newSession.user);
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
