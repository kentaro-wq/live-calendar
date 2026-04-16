import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  getAdminSecretFromRequest,
  isValidAdminSecret,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const hasAdminSession = await verifyAdminSessionToken(adminSession)

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!hasAdminSession) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname === '/api/events' && (method === 'POST' || method === 'DELETE')) {
    const headerSecret = getAdminSecretFromRequest(request)
    const hasHeaderAuth = isValidAdminSecret(headerSecret)

    if (!hasAdminSession && !hasHeaderAuth) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/events'],
}
