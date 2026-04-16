import { NextResponse } from 'next/server'
import { scrapeBlocBarIsshee, scrapeHotGate, scrapeWWW } from '@/lib/scraper'

// スクレイパーの動作確認用テストエンドポイント（本番では削除推奨）
// GET /api/cron/test?source=hotgate または ?source=www または ?source=bloc
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'hotgate'

  try {
    let events = []

    if (source === 'hotgate') {
      events = await scrapeHotGate()
    } else if (source === 'www') {
      events = await scrapeWWW(['ダースレイダー', 'Darthreider', 'The Bassons'])
    } else if (source === 'bloc') {
      events = await scrapeBlocBarIsshee(['ダースレイダー', 'Darthreider', 'DARTHREIDER', 'The Bassons'])
    } else {
      return NextResponse.json({ error: '不明なsource。hotgate / www / bloc を指定してください' }, { status: 400 })
    }

    return NextResponse.json({
      source,
      count: events.length,
      events,
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'テスト実行エラー' },
      { status: 500 }
    )
  }
}
