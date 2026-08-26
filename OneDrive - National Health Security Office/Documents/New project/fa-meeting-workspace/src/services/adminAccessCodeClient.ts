import { AdminAccessCodeService } from './adminAccessCodeService'
import { browserSupabaseClient } from './supabase/browserClientInstance'

export const adminAccessCodeService = new AdminAccessCodeService(browserSupabaseClient)
