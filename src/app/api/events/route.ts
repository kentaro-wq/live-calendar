import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/events - イベント一覧を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const artistSlug = searchParams.get('artist')
    const month = searchParams.get('month') // YYYY-MM形式

    const supabase = await createClient()

    // artistsと結合してイベントを取得
    let query = supabase
      .from('events')
      .select('*, artists(*)')
      .order('date', { ascending: true })

    // アーティストで絞り込む場合
    if (artistSlug) {
      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('slug', artistSlug)
        .single()

      if (artist) {
        query = query.eq('artist_id', artist.id)
      }
    }

    // 月で絞り込む場合（YYYY-MM形式）
    if (month) {
      const [year, mon] = month.split('-')
      const startDate = `${year}-${mon}-01`
      const endDate = new Date(parseInt(year), parseInt(mon), 0)
        .toISOString()
        .split('T')[0]
      query = query.gte('date', startDate).lte('date', endDate)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('イベント取得エラー:', error)
      return NextResponse.json(
        { error: 'イベントの取得に失敗しました' },
        { status: 500 }
      )
    }

    // アーティスト一覧も一緒に返す
    const { data: artists } = await supabase
      .from('artists')
      .select('*')
      .order('name')

    return NextResponse.json({ events: events ?? [], artists: artists ?? [] })
  } catch (e) {
    console.error('予期しないエラー:', e)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// POST /api/events - イベントを手動登録（SNS告知チェック画面から使用）
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { artist_id, title, venue, date, time, ticket_status, source_url, source_type } = body

    // バリデーション
    if (!artist_id || !title || !venue || !date) {
      return NextResponse.json(
        { error: 'アーティスト・タイトル・会場・日付は必須です' },
        { status: 400 }
      )
    }
    // YYYY-MM-DD 形式チェック
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: '日付は YYYY-MM-DD 形式で入力してください' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('events')
      .upsert(
        {
          artist_id,
          title,
          venue,
          date,
          time: time || null,
          ticket_status: ticket_status || 'チケット確認中',
          source_url: source_url || null,
          source_type: source_type || 'manual',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'artist_id,date,venue' }
      )
      .select('*, artists(*)')
      .single()

    if (error) {
      console.error('イベント登録エラー:', error)
      return NextResponse.json(
        { error: 'イベントの登録に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, event: data })
  } catch (e) {
    console.error('予期しないエラー:', e)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// DELETE /api/events?id=xxx - イベントを削除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'idが必要です' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('events').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('削除エラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
