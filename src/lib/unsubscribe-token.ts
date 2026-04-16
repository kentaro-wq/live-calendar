import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_EXPIRES_DAYS = 30

type UnsubscribePayload = {
  email: string
  exp: number
}

function getSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET が設定されていません')
  }
  return secret
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payloadEncoded: string) {
  return createHmac('sha256', getSecret()).update(payloadEncoded).digest('base64url')
}

export function createUnsubscribeToken(email: string, expiresInDays = DEFAULT_EXPIRES_DAYS) {
  const payload: UnsubscribePayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
  }

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribePayload | null {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payloadEncoded, signature] = parts
  const expectedSignature = sign(payloadEncoded)

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as UnsubscribePayload
    if (!payload.email || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
