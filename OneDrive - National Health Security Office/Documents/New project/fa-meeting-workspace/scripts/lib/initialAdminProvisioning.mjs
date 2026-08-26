export const INITIAL_ADMIN_EMAIL = 'pichailakarm@gmail.com'

function failPreflight() {
  throw new Error('Provisioning preflight failed')
}

export function isApprovedRedirectOrigin(value) {
  try {
    if (typeof value !== 'string' || value.includes('*')) return false
    const origin = new URL(value)
    if (
      origin.origin !== value
      || origin.pathname !== '/'
      || origin.search
      || origin.hash
      || origin.username
      || origin.password
    ) return false

    const isLocalDevelopment = (
      origin.protocol === 'http:'
      && (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1')
      && Boolean(origin.port)
    )
    const isHttpsPreview = (
      origin.protocol === 'https:'
      && !origin.port
      && origin.hostname.endsWith('.vercel.app')
      && origin.hostname.length > '.vercel.app'.length
    )
    return isLocalDevelopment || isHttpsPreview
  } catch {
    return false
  }
}

export function validateExecutionContext(context) {
  const expectedSupabaseUrl = `https://${context.linkedProjectRef}.supabase.co`
  if (
    context.targetEmail !== INITIAL_ADMIN_EMAIL
    || context.target !== 'staging'
    || context.stagingConfirmed !== true
    || context.hasServerCredentials !== true
    || !context.linkedProjectRef
    || context.linkedProjectRef !== context.capturedStagingRef
    || !/^[a-z0-9-]+$/.test(context.linkedProjectRef)
    || context.supabaseUrl !== expectedSupabaseUrl
    || !Array.isArray(context.redirectOrigins)
    || context.redirectOrigins.length === 0
    || new Set(context.redirectOrigins).size !== context.redirectOrigins.length
    || context.redirectOrigins.some((origin) => !isApprovedRedirectOrigin(origin))
  ) failPreflight()

  try {
    const redirect = new URL(context.redirectTo)
    if (
      redirect.pathname !== '/admin/auth/confirm'
      || redirect.search
      || redirect.hash
      || redirect.username
      || redirect.password
      || !context.redirectOrigins.includes(redirect.origin)
    ) {
      failPreflight()
    }
  } catch {
    failPreflight()
  }
}

function emit(report, status, requestId) {
  report?.(`${status} ${requestId}`)
}

export async function provisionInitialAdmin({
  mode,
  context,
  authAdmin,
  database,
  requestId,
  report,
}) {
  validateExecutionContext(context)

  if (mode === 'dry-run') {
    const result = { status: 'dry-run ready', requestId }
    emit(report, result.status, requestId)
    return result
  }

  if (mode !== 'execute') failPreflight()
  const existingUser = await authAdmin.findUserByEmail(INITIAL_ADMIN_EMAIL)
  let user = existingUser
  let invitationRequested = false

  if (!user) {
    user = await authAdmin.inviteUserByEmail(INITIAL_ADMIN_EMAIL, {
      redirectTo: context.redirectTo,
    })
    invitationRequested = true
    emit(report, 'invitation requested', requestId)
  }

  const profile = await database.findAdminProfile(user.id)
  const profileAlreadyActive = profile?.role === 'admin' && profile.is_active === true

  if (!profileAlreadyActive) {
    await database.upsertAdminProfile({
      user_id: user.id,
      role: 'admin',
      is_active: true,
    })
  }

  const auditExists = await database.findProvisioningAudit(user.id)
  if (!auditExists) {
    await database.insertAuditLog({
      actor_type: 'system',
      action: 'initial_admin_provisioned',
      target_table: 'admin_profiles',
      target_id: user.id,
      request_id: requestId,
      after_data: {
        invitation_requested: invitationRequested,
        role: 'admin',
        is_active: true,
      },
    })
  }

  const status = invitationRequested || !profileAlreadyActive
    ? 'profile activated'
    : 'already provisioned'
  const result = { status, requestId }
  emit(report, result.status, requestId)
  return result
}
