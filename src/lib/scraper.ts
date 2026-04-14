import * as cheerio from 'cheerio'
import { TicketStatus } from '@/types'

export type ScrapedEvent = {
  title: string
  venue: string
  date: string // YYYY-MM-DD
  time: string | null
  ticket_status: TicketStatus
  source_url: string
  source_type: 'peatix' | 'venue_site' | 'official_site'
  raw_text: string
}

// ============================================================
// HOT GATE（公式サイト）スクレイパー
// https://hotgate.link/gigs
// Tumblrベースのライブ情報ページから予定イベントを取得する
// ============================================================
export async function scrapeHotGate(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = []
  const SOURCE_URL = 'https://hotgate.link/gigs'

  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    })

    if (!res.ok) {
      console.error(`HOT GATEアクセスエラー: ${res.status}`)
      return []
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    // Tumblrのpostブロックを取得
    $('.post').each((_, el) => {
      try {
        const $el = $(el)
        $el.find('script, style').remove()

        // ブロック要素の境界を改行に変換してから行単位で解析する
        // （cheerioの.text()は改行を保持しないため）
        const innerHtml = $el.html() || ''
        const textWithBreaks = innerHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, '')         // 残タグを除去
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#\d+;/g, '')          // 数値参照を除去
        const lines = textWithBreaks
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0)

        // 日付行を探す（例：「4/11」単独、または行頭）
        const dateLineIdx = lines.findIndex(l => /^\d{1,2}\/\d{1,2}$/.test(l))
        if (dateLineIdx < 0) return

        const [month, day] = lines[dateLineIdx].split('/').map(Number)
        const resolvedDate = resolveYear(month, day)
        if (!resolvedDate) return

        // タイトル・会場を抽出
        // 日付行の次の行が「タイトルat 会場」または「タイトル」単独になっている
        const FOOTER_KEYWORDS = ['ベーソンズライブ日程', 'ベーソンズライブ情報', 'Open in app', 'Facebook', 'Tweet']
        const titleLine = lines[dateLineIdx + 1] || ''
        if (!titleLine || FOOTER_KEYWORDS.some(kw => titleLine.includes(kw))) return

        let title = titleLine
        let venue = '会場未定'

        // パターン1: 「タイトルat 会場」または「タイトル@ 会場」が1行にまとまっている
        // ※"at"の前にスペースがない場合も考慮（例: "○○LIVEat 新代田FEVER"）
        const mergedAtMatch = titleLine.match(/^(.+?)\s*(?:at|@)\s+(.+)$/)
        if (mergedAtMatch) {
          title = mergedAtMatch[1].trim()
          venue = mergedAtMatch[2].replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '').trim()
        } else {
          // パターン2: 次の行が「at」または「@」単独で、その次が会場名
          const atIdx = lines.findIndex((l, i) => i > dateLineIdx && /^(?:at|@)$/i.test(l))
          if (atIdx >= 0) {
            const venueRaw = lines[atIdx + 1] || '会場未定'
            venue = venueRaw.replace(/（[^）]*）$/, '').replace(/\([^)]*\)$/, '').trim()
          } else {
            // パターン3: 「@ 会場名」が1行になっている（香港など）
            const atLineIdx = lines.findIndex((l, i) => i > dateLineIdx && /^@\s/.test(l))
            if (atLineIdx >= 0) {
              venue = lines[atLineIdx].replace(/^@\s*/, '').trim()
            }
          }
        }

        // 開演時間：「START HH:MM」「開演】HH:MM」「HH:MM / HH:MM」の2番目
        const rawText = lines.join('\n')
        const startMatch =
          rawText.match(/START\s*(\d{1,2}:\d{2})/i) ||
          rawText.match(/開演[】\s]*(\d{1,2}:\d{2})/) ||
          rawText.match(/\d{1,2}:\d{2}\s*[\/／]\s*(\d{1,2}:\d{2})/)
        const time = startMatch ? startMatch[1] : null

        // チケットURL：PeatixやLivePocketなどが優先
        const ticketUrl = $el.find('a').filter((_, a) => {
          const href = $(a).attr('href') || ''
          return href.includes('peatix.com') || href.includes('livepocket') || href.includes('eplus.jp')
        }).first().attr('href') || SOURCE_URL

        events.push({
          title,
          venue,
          date: resolvedDate,
          time,
          ticket_status: guessTicketStatus(rawText),
          source_url: ticketUrl,
          source_type: 'official_site',
          raw_text: rawText.slice(0, 500),
        })
      } catch (e) {
        console.error('HOT GATEイベントパースエラー:', e)
      }
    })

    console.log(`HOT GATE: ${events.length}件取得`)
  } catch (e) {
    console.error('HOT GATEスクレイプエラー:', e)
  }

  return events
}

// ============================================================
// 渋谷WWWスクレイパー
// https://www-shibuya.jp/schedule/
// アーティスト名でフィルタリングして出演イベントのみ返す
// ============================================================
export async function scrapeWWW(artistKeywords: string[]): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = []

  // 今月と来月の2ヶ月分を取得
  const now = new Date()
  const months = [
    formatYM(now.getFullYear(), now.getMonth() + 1),
    formatYM(now.getFullYear(), now.getMonth() + 2),
  ]

  for (const ym of months) {
    const url = `https://www-shibuya.jp/schedule/?ym=${ym}`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      })

      if (!res.ok) {
        console.error(`WWWアクセスエラー (${ym}): ${res.status}`)
        continue
      }

      const html = await res.text()
      const $ = cheerio.load(html)
      const year = parseInt(ym.slice(0, 4))
      const month = parseInt(ym.slice(4, 6))

      // articleタグがイベント1件に対応する
      // 例: <article class="column Wed" data-place="www_x" event-id="event_019582">
      $('article').each((_, el) => {
        try {
          const $el = $(el)
          const rawText = $el.text().trim()

          // アーティスト名でフィルタリング
          const matched = artistKeywords.some(kw =>
            rawText.toLowerCase().includes(kw.toLowerCase())
          )
          if (!matched) return

          const day = parseInt($el.find('.day').text().trim())
          if (!day) return

          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // OPEN/STARTから開演時間を取得（例: "17:45 / 18:30"）
          const openstart = $el.find('.openstart').text().trim()
          const timeMatch = openstart.match(/START\s*(\d{1,2}:\d{2})|(\d{1,2}:\d{2})\s*$/)
          const time = timeMatch ? (timeMatch[1] || timeMatch[2]) : null

          // 会場の判定（data-placeから）
          const place = $el.attr('data-place') || 'www'
          const venueMap: Record<string, string> = {
            www: '渋谷 WWW',
            www_x: '渋谷 WWW X',
            www_b: '渋谷 WWW β',
          }
          const venue = venueMap[place] || '渋谷 WWW'

          const title = $el.find('.title').text().trim() || $el.find('.exp').text().trim()
          const href = $el.find('a').first().attr('href') || ''
          const sourceUrl = href.startsWith('http') ? href : `https://www-shibuya.jp${href}`

          events.push({
            title: title || `WWWライブ (${date})`,
            venue,
            date,
            time,
            ticket_status: guessTicketStatus(rawText),
            source_url: sourceUrl,
            source_type: 'venue_site',
            raw_text: rawText.slice(0, 500),
          })
        } catch (e) {
          console.error('WWWイベントパースエラー:', e)
        }
      })
    } catch (e) {
      console.error(`WWWスクレイプエラー (${ym}):`, e)
    }
  }

  console.log(`WWW: ${events.length}件取得`)
  return events
}

// ============================================================
// ユーティリティ関数
// ============================================================

// 「M/D」形式の日付に年を付ける
// 過去の日付（3ヶ月以上前）はスキップ、未来すぎる（1年超）もスキップ
function resolveYear(month: number, day: number): string | null {
  const now = new Date()
  const currentYear = now.getFullYear()

  for (const year of [currentYear, currentYear + 1]) {
    const candidate = new Date(year, month - 1, day)
    const diffMs = candidate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    // 過去90日以内〜未来365日以内のイベントを有効とする
    if (diffDays >= -90 && diffDays <= 365) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

// YYYYMM形式の文字列を生成
function formatYM(year: number, month: number): string {
  // 月が13になったら翌年1月に繰り上げ
  if (month > 12) {
    year += 1
    month -= 12
  }
  return `${year}${String(month).padStart(2, '0')}`
}

// テキストからチケット状況を推測する
export function guessTicketStatus(text: string): TicketStatus {
  if (/sold.?out|完売/i.test(text)) return '完売'
  if (/当日券/i.test(text)) return '当日券あり'
  if (/予約不要|入場無料|無料|フリー|free/i.test(text)) return '予約不要'
  if (/ADV|前売|要予約|チケット|ticket|LivePocket|Peatix|イープラス/i.test(text)) return '要予約'
  return 'チケット確認中'
}
