import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  ADMIN_SESSION_COOKIE,
  getCookieFromHeader,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

async function hasAdminAccess(request: Request) {
  const cookieHeader = request.headers.get('cookie')
  const session = getCookieFromHeader(cookieHeader, ADMIN_SESSION_COOKIE)
  return verifyAdminSessionToken(session)
}

// GET /api/artists - アーティスト一覧
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('artists')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: '取得失敗' }, { status: 500 })
  return NextResponse.json({ artists: data ?? [] })
}

// POST /api/artists - アーティスト追加（管理者のみ）
export async function POST(request: Request) {
  if (!(await hasAdminAccess(request))) {
    return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, website_url, x_handle, peatix_url } = body

  if (!name || !slug) {
    return NextResponse.json({ error: '名前とスラッグは必須です' }, { status: 400 })
  }

  // スラッグは英数字・ハイフンのみ
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'スラッグは英小文字・数字・ハイフンのみ使用可' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('artists')
    .insert({
      name,
      slug,
      website_url: website_url || null,
      x_handle: x_handle || null,
      peatix_url: peatix_url || null,
    })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('unique') ? 'そのスラッグはすでに使われています' : '登録に失敗しました'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true, artist: data })
}

// DELETE /api/artists?id=xxx - アーティスト削除（管理者のみ）
export async function DELETE(request: Request) {
  if (!(await hasAdminAccess(request))) {
    return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

  const supabase = createAdminClient()
  // アーティストに紐づくイベントも削除
  await supabase.from('events').delete().eq('artist_id', id)
  const { error } = await supabase.from('artists').delete().eq('id', id)

  if (error) return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  return NextResponse.json({ success: true })
}
