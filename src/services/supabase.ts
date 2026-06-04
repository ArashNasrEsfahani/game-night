// src/services/supabase.ts — optional, lazy client. Returns null when env is absent.
// The app is 100% functional signed-out; nothing may hard-depend on this returning a client.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  cached = url && key ? createClient(url, key) : null;
  return cached;
}

export function hasSupabase(): boolean {
  return getSupabase() !== null;
}
