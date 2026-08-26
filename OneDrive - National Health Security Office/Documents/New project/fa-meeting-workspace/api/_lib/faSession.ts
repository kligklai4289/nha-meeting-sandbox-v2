import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const claimsSchema = z.object({
  sessionId: z.uuid(),
  meetingId: z.uuid(),
  groupId: z.uuid(),
  expiresAt: z.iso.datetime(),
})

export type FaSessionClaims = z.infer<typeof claimsSchema>

function hmac(value: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(value, 'utf8').digest()
}

function normalizeAccessCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashFaAccessCode(value: string, pepper: string): string {
  return hmac(normalizeAccessCode(value), pepper).toString('hex')
}

export function safelyMatchesHash(actualHex: string, expectedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(actualHex) || !/^[0-9a-f]{64}$/i.test(expectedHex)) {
    return false
  }
  return timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'))
}

export function createFaSessionToken(
  claims: FaSessionClaims,
  signingSecret: string,
): string {
  const payload = Buffer.from(JSON.stringify(claimsSchema.parse(claims))).toString('base64url')
  const signature = hmac(payload, signingSecret).toString('base64url')
  return `${payload}.${signature}`
}

export function verifyFaSessionToken(
  token: string,
  signingSecret: string,
  now = new Date(),
): FaSessionClaims | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, suppliedSignature] = parts

  try {
    const expectedSignature = hmac(payload, signingSecret)
    const supplied = Buffer.from(suppliedSignature, 'base64url')
    if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
      return null
    }

    const parsed = claimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    )
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= now.getTime()) return null
    return parsed.data
  } catch {
    return null
  }
}

export function getFaSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === 'fa_session') return value.join('=') || null
  }
  return null
}

export function createFaSessionCookie(token: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
  return `fa_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`
}
