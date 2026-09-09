import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Credentials come from the environment. The fallbacks below point at the
// original (now-decommissioned) Supabase project and its public `anon` key,
// which are already in this repo's git history — kept only so an existing
// checkout keeps building. Rotate/replace via `.env` (see `.env.example`).
// The backend is being migrated off Supabase — see `docs/render-migration.md`.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://fdqgvjgcoidqwvemavaa.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcWd2amdjb2lkcXd2ZW1hdmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMzMjQwMTAsImV4cCI6MjA0ODkwMDAxMH0.-IuGTf07mMhtEQl9wtpTSG5PB5fNHS95f6PCEkJwUEE';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
