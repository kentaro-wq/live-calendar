import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  getCookieFromHeader,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

export const maxDuration = 60

// 管理者セッションで認証されたクロール実行エンドポイント
export async function POST(request: Request) {
  // 管理者セッションチェック
  const cookieHeader = request.headers.get('cookie')
  const token = getCookieFromHeader(cookieHeader, ADMIN_SESSION_COOKIE)
  const authenticated = await verifyAdminSessionToken(token)

  if (!authenticated) {
    return NextResponse.json({ error: '管理者ログインが必要です' }, { status: 401 })
  }

  // 自身のcron/crawlエンドポイントをCRON_SECRETつきで呼び出す
  const cronSecret = process.env.CRON_SECRET
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  try {
    const res = await fetch(`${baseUrl}/api/cron/crawl`, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    console.error('クロール実行エラー:', e)
    return NextResponse.json(
      { error: 'クロール実行中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
