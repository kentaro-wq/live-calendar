import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getCookieFromHeader,
  getAdminSessionMaxAgeSeconds,
  isValidAdminSecret,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = getCookieFromHeader(cookieHeader, ADMIN_SESSION_COOKIE)
    const authenticated = await verifyAdminSessionToken(token)
    return NextResponse.json({ authenticated })
  } catch (e) {
    console.error('管理者セッション確認エラー:', e)
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (!isValidAdminSecret(password)) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    }

    const sessionToken = await createAdminSessionToken()
    const response = NextResponse.json({ success: true })
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: getAdminSessionMaxAgeSeconds(),
    })

    return response
  } catch (e) {
    console.error('管理者セッション作成エラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
