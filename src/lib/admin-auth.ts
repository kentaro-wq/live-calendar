export const ADMIN_SESSION_COOKIE = 'admin_session'
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

type AdminSessionPayload = {
  role: 'admin'
  exp: number
}

function getAdminSecret() {
  return process.env.ADMIN_SECRET
}

export function isValidAdminSecret(value: string | null | undefined) {
  const secret = getAdminSecret()
  return Boolean(secret && value && value === secret)
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function safeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function sign(payloadEncoded: string) {
  const secret = getAdminSecret()
  if (!secret) return null

  const data = new TextEncoder().encode(payloadEncoded)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Buffer.from(signature).toString('base64url')
}

export async function createAdminSessionToken() {
  const payload: AdminSessionPayload = {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  }
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload))
  const signature = await sign(payloadEncoded)
  if (!signature) throw new Error('ADMIN_SECRET が設定されていません')
  return `${payloadEncoded}.${signature}`
}

export async function verifyAdminSessionToken(token: string | null | undefined) {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payloadEncoded, signature] = parts
  const expected = await sign(payloadEncoded)
  if (!expected) return false
  if (!safeEqualString(signature, expected)) return false

  try {
    const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as AdminSessionPayload
    if (payload.role !== 'admin') return false
    return payload.exp >= Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function getAdminSecretFromRequest(request: Request) {
  const directHeader = request.headers.get('x-admin-secret')
  if (directHeader) return directHeader

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return null
}

export function getCookieFromHeader(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';')
  for (const c of cookies) {
    const [rawName, ...rest] = c.trim().split('=')
    if (rawName === cookieName) {
      return rest.join('=')
    }
  }
  return null
}

export function getAdminSessionMaxAgeSeconds() {
  return ADMIN_SESSION_MAX_AGE_SECONDS
}
