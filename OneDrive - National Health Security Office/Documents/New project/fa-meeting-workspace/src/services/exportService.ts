import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

export class ExportService {
  private readonly client: SupabaseClient<Database>
  constructor(client: SupabaseClient<Database>) { this.client = client }
  async download(format: 'excel' | 'powerpoint', scope: 'group' | 'all', groupId?: string, draft = false) {
    const { data } = await this.client.auth.getSession(); const token = data.session?.access_token
    if (!token) throw new Error('ADMIN_UNAUTHENTICATED')
    const query = new URLSearchParams({ scope, draft: String(draft) }); if (groupId) query.set('groupId', groupId)
    const response = await fetch(`/api/exports/${format}?${query}`, { headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) throw new Error('EXPORT_FAILED')
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = format === 'excel' ? 'fa-meeting-report.xlsx' : 'fa-meeting-report.pptx'
    anchor.hidden = true; document.body.append(anchor); anchor.click(); anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
