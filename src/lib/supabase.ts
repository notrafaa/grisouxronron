import { createClient } from "@supabase/supabase-js";

export type CatId = "grisou" | "ronron";

export type GameProfile = {
  id: string;
  username: string;
  selected_cat: CatId;
  treats: number;
  total_clicks: number;
  click_power: number;
  auto_rate: number;
  multiplier: number;
  upgrades: Record<string, number>;
  rebirths: number;
  lifetime_treats: number;
  cat_levels: Record<CatId, number>;
  updated_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const looksLikeSupabaseUrl =
  supabaseUrl?.includes(".supabase.co") || supabaseUrl?.includes(".supabase.com");

export const isSupabaseMisconfigured = Boolean(supabaseUrl && !looksLikeSupabaseUrl);
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && looksLikeSupabaseUrl);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;
