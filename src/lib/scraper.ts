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

    const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD

    // Tumblrのpostブロックを取得
    $('.post').each((_, el) => {
      try {
        const $el = $(el)

        // ── ① Tumblr記事の公開日時チェック ──────────────────────────────
        // Tumblrは <article data-timestamp="UNIX秒"> を付与する。
        // 1年以上前の記事はスキップ（古い記事の日付を誤って現在年に解決しないため）
        const tsAttr = $el.attr('data-timestamp')
        const postYear = (() => {
          if (tsAttr && /^\d+$/.test(tsAttr)) {
            const postDate = new Date(parseInt(tsAttr) * 1000)
            const ageMs = Date.now() - postDate.getTime()
            if (ageMs > 365 * 24 * 60 * 60 * 1000) return null // 1年超の記事は除外
            return postDate.getFullYear()
          }
          return null // タイムスタンプなし：年不明
        })()

        // タイムスタンプで1年超と判定された場合はスキップ
        if (tsAttr && postYear === null) return

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

        // ── ② 日付行を探す ────────────────────────────────────────────
        // パターンA: YYYY/M/D（年付き）→ そのまま使用
        // パターンB: M/D のみ → 年を推定
        const dateLineIdx = lines.findIndex(l =>
          /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(l) || /^\d{1,2}\/\d{1,2}$/.test(l)
        )
        if (dateLineIdx < 0) return

        const dateLine = lines[dateLineIdx]
        let resolvedDate: string | null = null

        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateLine)) {
          // YYYY/M/D 形式：年が明示されているのでそのまま使う
          const [y, m, d] = dateLine.split('/').map(Number)
          const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          if (candidate < todayStr) return // 今日より前はスキップ
          resolvedDate = candidate
        } else {
          // M/D 形式：記事公開年を優先して年を決定する
          const [month, day] = dateLine.split('/').map(Number)
          if (postYear !== null) {
            // Tumblrの公開年と翌年を候補に、今日以降の最近い日付を選ぶ
            resolvedDate = resolveYearFrom(month, day, [postYear, postYear + 1], todayStr)
          } else {
            // タイムスタンプがない場合は従来ロジック（今年・来年の今日以降）
            resolvedDate = resolveYear(month, day)
          }
          if (!resolvedDate) return
        }

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

          // 今日より前の日付はスキップ（月の前半を取得した際の過去日付を除外）
          const todayStr = new Date().toLocaleDateString('sv-SE')
          if (date < todayStr) return

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
// bloc: Bar Isshee スクレイパー
// http://www.bloc.jp/barisshee/
// 特定アーティストに一致するイベントのみ抽出する
// ============================================================
export async function scrapeBlocBarIsshee(artistKeywords: string[]): Promise<ScrapedEvent[]> {
  const SOURCE_URL = 'http://www.bloc.jp/barisshee/'
  const events: ScrapedEvent[] = []

  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    })

    if (!res.ok) {
      console.error(`blocアクセスエラー: ${res.status}`)
      return []
    }

    const html = await res.text()
    const $ = cheerio.load(html)
    const keywordLower = artistKeywords.map((kw) => kw.toLowerCase())

    $('tr').each((_, row) => {
      try {
        const cells = $(row).find('td')
        if (cells.length < 4) return

        const typeText = cells.eq(0).text().trim()
        if (!typeText.includes('ライブ')) return

        const dateText = cells.eq(1).text().trim()
        const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/)
        if (!dateMatch) return

        const month = Number(dateMatch[1])
        const day = Number(dateMatch[2])
        const date = resolveYear(month, day)
        if (!date) return

        const title = normalizeSpaces(cells.eq(2).text()) || 'Bar Isshee ライブ'
        const detailText = normalizeSpaces(cells.eq(3).text())
        const searchableText = `${title} ${detailText}`.toLowerCase()

        const matched = keywordLower.some((kw) => searchableText.includes(kw))
        if (!matched) return

        const timeMatch = detailText.match(/start\s*(\d{1,2}:\d{2})/i)
        const time = timeMatch ? timeMatch[1] : null

        const venueMatch = detailText.match(/東京【([^】]+)】/)
        const venue = venueMatch ? venueMatch[1].trim() : '千駄木 Bar Isshee'

        const sourceHref =
          cells.eq(3).find('a[href*="/data/"]').first().attr('href') ||
          cells.eq(3).find('a').first().attr('href') ||
          SOURCE_URL
        const sourceUrl = sourceHref.startsWith('http') ? sourceHref : new URL(sourceHref, SOURCE_URL).toString()

        events.push({
          title,
          venue,
          date,
          time,
          ticket_status: guessTicketStatus(detailText),
          source_url: sourceUrl,
          source_type: 'official_site',
          raw_text: `${title}\n${detailText}`.slice(0, 500),
        })
      } catch (e) {
        console.error('blocイベントパースエラー:', e)
      }
    })
  } catch (e) {
    console.error('blocスクレイプエラー:', e)
  }

  console.log(`bloc: ${events.length}件取得`)
  return events
}

// ============================================================
// ユーティリティ関数
// ============================================================

// 「M/D」形式の日付に年を付ける
// 今日より前の日付はスキップ（過去イベントをDBに保存しないガードレール）
// 未来すぎる（1年超）もスキップ
function resolveYear(month: number, day: number): string | null {
  const now = new Date()
  // 日付比較は「日付のみ」で行う（時刻を切り捨て、JST 0:00 相当）
  const todayStr = now.toLocaleDateString('sv-SE') // YYYY-MM-DD
  const currentYear = now.getFullYear()

  for (const year of [currentYear, currentYear + 1]) {
    const candidateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const candidate = new Date(year, month - 1, day)
    const diffMs = candidate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    // 今日以降〜未来365日以内のイベントのみ有効（今日の日付は含む）
    if (candidateStr >= todayStr && diffDays <= 365) {
      return candidateStr
    }
  }
  return null
}

// 指定した年リストの中から「今日以降の最も近い日付」を返す
// Tumblrの記事公開年を元に年を確定するために使用
function resolveYearFrom(
  month: number,
  day: number,
  candidateYears: number[],
  todayStr: string
): string | null {
  for (const year of candidateYears) {
    const candidateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (candidateStr >= todayStr) {
      return candidateStr
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

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
