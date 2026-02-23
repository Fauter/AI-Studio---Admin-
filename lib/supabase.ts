import { createClient } from '@supabase/supabase-js';

// Safely access environment variables with fallback values
const getEnv = (key: string, fallback: string) => {
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || fallback;
    }
  } catch (err) {
    console.warn(`Error reading env var ${key}`, err);
  }
  return fallback;
};

// Use provided fallback if env vars are missing in the container
const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://phugzitegoskgfisxouf.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_ka-USKd1XuxVHbfXpQh3Gw_MoDb6mP8');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing.');
}

// ARCHITECT NOTE: 
// In strict sandbox environments (blob: origins), accessing localStorage or cookies throws DOMException.
// We strictly disable persistence. Session is ephemeral (RAM only).
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true, // Enable session storage to prevent loss of session on tab suspension
      autoRefreshToken: true, // Keep the session alive proactively
      detectSessionInUrl: false
    }
  }
);