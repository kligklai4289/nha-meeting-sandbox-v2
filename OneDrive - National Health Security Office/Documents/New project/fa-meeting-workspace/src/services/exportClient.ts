import { ExportService } from './exportService'
import { browserSupabaseClient } from './supabase/browserClientInstance'
export const exportService = new ExportService(browserSupabaseClient)
