import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { scrapeBlocBarIsshee, scrapeHotGate, scrapeWWW } from '@/lib/scraper'

// スクレイパーの動作確認用テストエンドポイント（本番では削除推奨）
// GET /api/cron/test?source=hotgate または ?source=www または ?source=bloc
// GET /api/cron/test?source=bloc-debug  → bloc.jpのHTML構造を診断
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') || 'hotgate'

  try {
    // ── デバッグモード: bloc.jpのHTML構造を確認 ──────────────────────────
    if (source === 'bloc-debug') {
      const res = await fetch('http://www.bloc.jp/barisshee/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      })
      const html = await res.text()
      const $ = cheerio.load(html)

      // テーブル行の状況
      const trCount = $('tr').length
      const tdRows = $('tr').toArray().map(row => {
        const cells = $(row).find('td')
        return {
          tdCount: cells.length,
          firstCell: cells.eq(0).text().trim().slice(0, 30),
          text: $(row).text().trim().slice(0, 80),
        }
      }).filter(r => r.tdCount > 0).slice(0, 20)

      // 全リンク
      const links = $('a').toArray().map(el => $(el).attr('href') || '').filter(h => h).slice(0, 30)

      return NextResponse.json({
        status: res.status,
        trCount,
        tdRows,
        links,
        htmlSnippet: html.slice(0, 1000),
      })
    }

    let events = []

    if (source === 'hotgate') {
      events = await scrapeHotGate()
    } else if (source === 'www') {
      events = await scrapeWWW(['ダースレイダー', 'Darthreider', 'The Bassons'])
    } else if (source === 'bloc') {
      events = await scrapeBlocBarIsshee(['ダースレイダー', 'Darthreider', 'DARTHREIDER', 'The Bassons'])
    } else {
      return NextResponse.json({ error: '不明なsource。hotgate / www / bloc / bloc-debug を指定してください' }, { status: 400 })
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
