/**
 * The AI section shares Next Gen's single Supabase client/session rather
 * than creating a second one — a second client meant a second auth
 * instance (duplicate GoTrueClient warnings, session drift) and required
 * an env var (VITE_SUPABASE_PUBLISHABLE_KEY) this project's .env never
 * defined, which crashed the whole /ai route on load.
 */
export { supabase } from '@/lib/supabase';
