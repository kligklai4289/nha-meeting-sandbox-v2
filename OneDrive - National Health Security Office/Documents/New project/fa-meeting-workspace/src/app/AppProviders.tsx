import type { PropsWithChildren } from 'react'
import { AdminAuthProvider } from '../services/auth/adminAuthContext'
import { SupabaseAdminAuth } from '../services/auth/supabaseAdminAuth'
import { HttpMeetingDirectory } from '../services/httpMeetingDirectory'
import { HttpFaRepository } from '../services/httpFaRepository'
import { FaRepositoryProvider } from '../services/faRepositoryContext'
import { MeetingDirectoryProvider } from '../services/meetingDirectoryContext'
import { browserSupabaseClient } from '../services/supabase/browserClientInstance'
import { RepositoryProvider } from '../services/repositoryContext'
import { AdminMeetingRepository, SupabaseAdminMeetingGateway } from '../services/supabase/adminMeetingRepository'

const meetingDirectory = new HttpMeetingDirectory('/api/public/active-meeting')
const faRepository = new HttpFaRepository()
const supabaseClient = browserSupabaseClient
const adminAuth = new SupabaseAdminAuth(supabaseClient)
const adminRepository = new AdminMeetingRepository(new SupabaseAdminMeetingGateway(supabaseClient))

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MeetingDirectoryProvider directory={meetingDirectory}>
      <RepositoryProvider repository={adminRepository}>
        <FaRepositoryProvider repository={faRepository}>
          <AdminAuthProvider gateway={adminAuth}>{children}</AdminAuthProvider>
        </FaRepositoryProvider>
      </RepositoryProvider>
    </MeetingDirectoryProvider>
  )
}
