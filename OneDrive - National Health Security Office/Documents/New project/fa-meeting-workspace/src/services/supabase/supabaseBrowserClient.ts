import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { PublicEnv } from '../../config/publicEnv'
import type { Database } from './database.types'

type BrowserClient = ReturnType<typeof createClient<Database>>
let sharedClient: BrowserClient | null = null

export const browserAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
} as const

export function createSupabaseBrowserClient(env: PublicEnv) {
  const options: SupabaseClientOptions<'public'> = { auth: browserAuthOptions }
  return createClient<Database>(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    options,
  )
}

export function getSupabaseBrowserClient(env: PublicEnv): BrowserClient {
  sharedClient ??= createSupabaseBrowserClient(env)
  return sharedClient
}
