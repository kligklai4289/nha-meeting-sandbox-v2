import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/services/supabase/database.types.js'
import type { ServerEnv } from './serverEnv.js'

export function createSupabaseServerClient(
  env: ServerEnv,
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
