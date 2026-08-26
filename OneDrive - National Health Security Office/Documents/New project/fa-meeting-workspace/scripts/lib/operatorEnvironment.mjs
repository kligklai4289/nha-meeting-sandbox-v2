import { isApprovedRedirectOrigin } from './initialAdminProvisioning.mjs'

function isUrl(value) {
  try {
    return new URL(value).href.length > 0
  } catch {
    return false
  }
}

function parseRedirectOrigins(value) {
  if (typeof value !== 'string') return null
  const origins = value.split(',').map((origin) => origin.trim())
  if (
    origins.length === 0
    || origins.some((origin) => !isApprovedRedirectOrigin(origin))
    || new Set(origins).size !== origins.length
  ) return null
  return origins
}

export function parseOperatorEnvironment(input) {
  const failures = []
  const redirectOrigins = parseRedirectOrigins(input.INITIAL_ADMIN_REDIRECT_ORIGINS)

  if (!isUrl(input.SUPABASE_URL)) failures.push('SUPABASE_URL')
  if (typeof input.SUPABASE_SECRET_KEY !== 'string'
    || !input.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
    failures.push('SUPABASE_SECRET_KEY')
  }
  if (typeof input.FA_SESSION_SIGNING_SECRET !== 'string'
    || input.FA_SESSION_SIGNING_SECRET.length < 32) {
    failures.push('FA_SESSION_SIGNING_SECRET')
  }
  if (typeof input.FA_CODE_PEPPER !== 'string' || input.FA_CODE_PEPPER.length < 32) {
    failures.push('FA_CODE_PEPPER')
  }
  if (!isUrl(input.INITIAL_ADMIN_REDIRECT_TO)) {
    failures.push('INITIAL_ADMIN_REDIRECT_TO')
  }
  if (!redirectOrigins) failures.push('INITIAL_ADMIN_REDIRECT_ORIGINS')

  if (failures.length > 0) {
    throw new Error(`Invalid operator environment configuration: ${failures.sort().join(', ')}`)
  }

  return {
    SUPABASE_URL: input.SUPABASE_URL,
    SUPABASE_SECRET_KEY: input.SUPABASE_SECRET_KEY,
    FA_SESSION_SIGNING_SECRET: input.FA_SESSION_SIGNING_SECRET,
    FA_CODE_PEPPER: input.FA_CODE_PEPPER,
    INITIAL_ADMIN_REDIRECT_TO: input.INITIAL_ADMIN_REDIRECT_TO,
    INITIAL_ADMIN_REDIRECT_ORIGINS: redirectOrigins,
  }
}
