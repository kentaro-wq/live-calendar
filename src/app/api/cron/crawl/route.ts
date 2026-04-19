import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { scrapeBlocBarIsshee, scrapeHotGate, scrapeWWW, scrapePeatix, scrapeGoogleSearch, ScrapedEvent } from '@/lib/scraper'
import { sendNewEventNotification } from '@/lib/mailer'
import { Artist } from '@/types'

// Vercel Cronから呼ばれるエンドポイント（毎日AM9:00 JST）
// Authorization ヘッダーで不正アクセスを防止
export async function GET(request: Request) {
  // セキュリティチェック：CRON_SECRETが一致するか確認
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }

  console.log('クロール開始:', new Date().toISOString())

  const supabase = createAdminClient()

  // 過去イベントをDBから削除（今日より前の日付）
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const { error: deleteError, count: deletedCount } = await supabase
    .from('events')
    .delete({ count: 'exact' })
    .lt('date', todayStr)
  if (deleteError) {
    console.warn('過去イベント削除エラー:', deleteError.message)
  } else {
    console.log(`過去イベント削除: ${deletedCount ?? 0}件`)
  }
  const newEventsAll: any[] = []
  const results: Record<string, { scraped: number; saved: number; errors: number }> = {}

  try {
    // アーティスト一覧を取得
    const { data: artists, error: artistsError } = await supabase
      .from('artists')
      .select('*')

    if (artistsError || !artists) {
      return NextResponse.json(
        { error: 'アーティスト取得失敗' },
        { status: 500 }
      )
    }

    // 各アーティストについてクロール
    for (const artist of artists) {
      // 「その他」は手動登録専用のためクロールしない
      if (artist.slug === 'others') continue

      console.log(`クロール中: ${artist.name}`)
      results[artist.name] = { scraped: 0, saved: 0, errors: 0 }

      // 情報源ごとにスクレイピング（slugがdarth-reiderのアーティストはHOT GATE優先）
      const scrapedEvents: ScrapedEvent[] = []

      if (artist.slug === 'darth-reider') {
        // HOT GATEは放置状態のため無効化

        // ① 渋谷WWW（出演が判明した場合のみ追加）
        const wwwEvents = await scrapeWWW([artist.name, 'Darthreider', 'DARTHREIDER', 'The Bassons'])
        scrapedEvents.push(...wwwEvents)

        // ② bloc: Bar Isshee（出演キーワードに一致するもののみ）
        const blocEvents = await scrapeBlocBarIsshee([artist.name, 'Darthreider', 'DARTHREIDER', 'The Bassons'])
        scrapedEvents.push(...blocEvents)

        // ③ Peatix検索
        const peatixEvents = await scrapePeatix([artist.name, 'Darthreider'])
        scrapedEvents.push(...peatixEvents)

        // ④ Google Custom Search（広くひっかける）
        const googleEvents = await scrapeGoogleSearch(artist.name, [artist.name, 'Darthreider'])
        scrapedEvents.push(...googleEvents)
      } else {
        // 他のアーティストはWWW + Peatix + Google検索
        const wwwEvents = await scrapeWWW([artist.name])
        scrapedEvents.push(...wwwEvents)

        const peatixEvents = await scrapePeatix([artist.name])
        scrapedEvents.push(...peatixEvents)

        // Google Custom Search
        const googleEvents = await scrapeGoogleSearch(artist.name, [artist.name])
        scrapedEvents.push(...googleEvents)
      }

      results[artist.name].scraped = scrapedEvents.length
      console.log(`${artist.name}: ${scrapedEvents.length}件取得`)

      // 取得したイベントをDBに保存
      for (const scraped of scrapedEvents) {
        const newEvent = await upsertEvent(supabase, artist, scraped)
        if (newEvent) {
          newEventsAll.push({ ...newEvent, artists: artist })
          results[artist.name].saved++
        } else {
          results[artist.name].errors++
        }
      }
    }

    // 新着イベントがあれば購読者にメール通知
    if (newEventsAll.length > 0) {
      await notifySubscribers(supabase, newEventsAll)
    }

    return NextResponse.json({
      success: true,
      message: `クロール完了。新着${newEventsAll.length}件`,
      newEventsCount: newEventsAll.length,
      details: results,
    })
  } catch (e) {
    console.error('クロール全体エラー:', e)
    return NextResponse.json(
      { error: 'クロール処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

// イベントをDBにupsertする（新規作成の場合はデータを返す）
async function upsertEvent(
  supabase: ReturnType<typeof createAdminClient>,
  artist: Artist,
  scraped: ScrapedEvent
): Promise<any | null> {
  // ガードレール：今日より前の日付は保存しない（スクレイパー側のバグに対する最終防衛線）
  const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD (JST相当)
  if (scraped.date < todayStr) {
    console.warn(`過去日付のためスキップ: ${scraped.date} ${scraped.venue} (${artist.name})`)
    return null
  }

  try {
    const now = new Date().toISOString()

    // 手動編集済みのイベントは上書きしない
    const { data: existing } = await supabase
      .from('events')
      .select('id, manually_edited')
      .eq('artist_id', artist.id)
      .eq('date', scraped.date)
      .eq('venue', scraped.venue)
      .maybeSingle()

    if (existing?.manually_edited) {
      console.log(`手動編集済みのためスキップ: ${scraped.date} ${scraped.venue}`)
      return null
    }

    const { data: saved, error } = await supabase
      .from('events')
      .upsert(
        {
          artist_id: artist.id,
          title: scraped.title,
          venue: scraped.venue,
          date: scraped.date,
          time: scraped.time,
          ticket_status: scraped.ticket_status,
          source_url: scraped.source_url,
          source_type: scraped.source_type,
          raw_text: scraped.raw_text,
          updated_at: now,
        },
        { onConflict: 'artist_id,date,venue' }
      )
      .select()
      .single()

    if (error) {
      console.error(`イベント保存エラー (${scraped.date} ${scraped.venue}):`, error.message)
      return null
    }

    // created_at と updated_at が同じ＝新規作成されたイベント
    if (saved && saved.created_at === saved.updated_at) {
      console.log(`新着イベント: ${saved.date} ${saved.venue} ${saved.title}`)
      return saved
    }

    return null // 既存イベントの更新は通知しない
  } catch (e) {
    console.error('upsertエラー:', e)
    return null
  }
}

// 購読者にメール通知を送る
async function notifySubscribers(
  supabase: ReturnType<typeof createAdminClient>,
  newEvents: any[]
) {
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('is_active', true)

  if (!subscriptions || subscriptions.length === 0) return

  for (const sub of subscriptions) {
    // 購読しているアーティストの新着イベントだけ抽出
    const relevantEvents = newEvents.filter((e) =>
      sub.artist_ids.includes(e.artist_id)
    )

    if (relevantEvents.length === 0) continue

    try {
      await sendNewEventNotification({ email: sub.email, newEvents: relevantEvents })
      console.log(`通知送信: ${sub.email} (${relevantEvents.length}件)`)
    } catch (e) {
      console.error(`通知送信エラー (${sub.email}):`, e)
    }
  }
}
