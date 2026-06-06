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
  updated_at?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;
