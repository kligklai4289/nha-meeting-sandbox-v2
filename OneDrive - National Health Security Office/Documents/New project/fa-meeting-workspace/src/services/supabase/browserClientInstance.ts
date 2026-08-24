import { parsePublicEnv } from '../../config/publicEnv'
import { getSupabaseBrowserClient } from './supabaseBrowserClient'

const publicEnv = parsePublicEnv({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

export const browserSupabaseClient = getSupabaseBrowserClient(publicEnv)
