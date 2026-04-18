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
// Google Custom Search スクレイパー
// 「ダースレイダー ライブ」でGoogle検索し、各ページから日付・会場を抽出
// ============================================================
export async function scrapeGoogleSearch(keywords: string[]): Promise<ScrapedEvent[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  const cseId = process.env.GOOGLE_CSE_ID
  if (!apiKey || !cseId) {
    console.warn('GOOGLE_API_KEY または GOOGLE_CSE_ID が未設定')
    return []
  }

  const events: ScrapedEvent[] = []
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const seenUrls = new Set<string>()

  const currentYear = new Date().getFullYear()

  for (const keyword of keywords) {
    try {
      const query = encodeURIComponent(`${keyword} ライブ 出演 ${currentYear}`)
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${query}&num=10&lr=lang_ja`
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`Google検索エラー (${keyword}): ${res.status}`)
        continue
      }
      const data = await res.json()
      const items = data.items || []
      console.log(`Google検索「${keyword}」: ${items.length}件`)

      for (const item of items) {
        const pageUrl: string = item.link || ''
        if (!pageUrl || seenUrls.has(pageUrl)) continue
        seenUrls.add(pageUrl)

        // snippetから日付と会場を抽出（ページを開かずに済む場合）
        const snippet: string = (item.snippet || '') + ' ' + (item.title || '')
        const extracted = extractEventFromText(snippet, pageUrl, todayStr)
        if (extracted) {
          events.push(extracted)
          continue
        }

        // snippetで取れない場合はページを取得
        try {
          const pageRes = await fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja' },
            signal: AbortSignal.timeout(8000),
          })
          if (!pageRes.ok) continue
          const html = await pageRes.text()
          const $ = cheerio.load(html)
          $('script, style, nav, footer, header').remove()
          const text = $('body').text().replace(/\s+/g, ' ').slice(0, 2000)
          const pageExtracted = extractEventFromText(text, pageUrl, todayStr)
          if (pageExtracted) events.push(pageExtracted)
        } catch {
          // タイムアウトなどはスキップ
        }
      }
    } catch (e) {
      console.error(`Google検索スクレイプエラー (${keyword}):`, e)
    }
  }

  // 重複除去（同じ日付＋会場）
  const unique = events.filter((e, i, arr) =>
    arr.findIndex(x => x.date === e.date && x.venue === e.venue) === i
  )
  console.log(`Google検索: ${unique.length}件取得`)
  return unique
}

// テキストからイベント情報を抽出するヘルパー
function extractEventFromText(text: string, sourceUrl: string, todayStr: string): ScrapedEvent | null {
  // 年が明示された日付パターンのみ受け付ける（年なし日付は誤判定の原因になるため除外）
  // YYYY年M月D日 / YYYY/M/D / YYYY-M-D
  const datePatterns = [
    /(\d{4})[年](\d{1,2})[月](\d{1,2})日?/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
  ]

  let resolvedDate: string | null = null

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern)
    if (dateMatch) {
      const y = parseInt(dateMatch[1])
      const m = parseInt(dateMatch[2])
      const d = parseInt(dateMatch[3])
      // 妥当な年かチェック（今年〜来年のみ）
      const thisYear = new Date().getFullYear()
      if (y < thisYear || y > thisYear + 1) continue
      const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (candidate >= todayStr) { resolvedDate = candidate; break }
    }
  }
  if (!resolvedDate) return null

  // 会場を抽出（「@」「at」「会場」「会場：」などの後）
  const venueMatch = text.match(/(?:@|at\s|会場[：:]\s*|にて\s*)([^\s,、。\n]{2,20})/i)
  const venue = venueMatch ? venueMatch[1].trim() : '会場未定'

  // タイトル（URLのドメインまたは検索結果タイトルから）
  const domain = (() => { try { return new URL(sourceUrl).hostname } catch { return 'イベント' } })()

  return {
    title: `ダースレイダー出演イベント`,
    venue,
    date: resolvedDate,
    time: null,
    ticket_status: guessTicketStatus(text),
    source_url: sourceUrl,
    source_type: domain.includes('peatix') ? 'peatix' : 'venue_site',
    raw_text: text.slice(0, 500),
  }
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
    // ★ 先頭 MAX_POSTS 件のみ処理（Tumblrは新着順 → 古い記事を読み込まない）
    const MAX_POSTS = 15
    const allPosts = $('.post').toArray().slice(0, MAX_POSTS)

    for (const el of allPosts) {
      try {
        const $el = $(el)

        // ── ① Tumblr記事の公開日時チェック ──────────────────────────────
        // Tumblrは <article data-timestamp="UNIX秒"> を付与する。
        // 1年以上前の記事はスキップ（古い記事の日付を誤って現在年に解決しないため）
        const tsAttr = $el.attr('data-timestamp')
        const { postYear, postDateObj } = (() => {
          if (tsAttr && /^\d+$/.test(tsAttr)) {
            const pd = new Date(parseInt(tsAttr) * 1000)
            const ageMs = Date.now() - pd.getTime()
            if (ageMs > 180 * 24 * 60 * 60 * 1000) return { postYear: null, postDateObj: null } // 6ヶ月超の記事は除外
            return { postYear: pd.getFullYear(), postDateObj: pd }
          }
          return { postYear: null, postDateObj: null } // タイムスタンプなし：年不明
        })()

        // タイムスタンプで1年超と判定された場合はスキップ
        if (tsAttr && postYear === null) continue


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
        if (dateLineIdx < 0) continue

        const dateLine = lines[dateLineIdx]
        let resolvedDate: string | null = null

        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateLine)) {
          // YYYY/M/D 形式：年が明示されているのでそのまま使う
          const [y, m, d] = dateLine.split('/').map(Number)
          const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          if (candidate < todayStr) continue // 今日より前はスキップ
          resolvedDate = candidate
        } else {
          // M/D 形式：記事公開年を優先して年を決定する
          const [month, day] = dateLine.split('/').map(Number)
          if (postYear !== null && postDateObj !== null) {
            // 記事公開日を使って年を確定する（単純に翌年へ繰り上げると過去イベントが混入する）
            resolvedDate = resolveYearFrom(month, day, postDateObj, todayStr)
          } else {
            // タイムスタンプがない場合は従来ロジック（今年・来年の今日以降）
            resolvedDate = resolveYear(month, day)
          }
          if (!resolvedDate) continue
        }

        // タイトル・会場を抽出
        // 日付行の次の行が「タイトルat 会場」または「タイトル」単独になっている
        const FOOTER_KEYWORDS = ['ベーソンズライブ日程', 'ベーソンズライブ情報', 'Open in app', 'Facebook', 'Tweet']
        const titleLine = lines[dateLineIdx + 1] || ''
        if (!titleLine || FOOTER_KEYWORDS.some(kw => titleLine.includes(kw))) continue

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
    }

    console.log(`HOT GATE: ${events.length}件取得（先頭${MAX_POSTS}件の記事を処理）`)
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
  const MAIN_URL = 'http://www.bloc.jp/barisshee/'
  const events: ScrapedEvent[] = []

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  }

  try {
    const res = await fetch(MAIN_URL, { headers })

    if (!res.ok) {
      console.error(`blocアクセスエラー: ${res.status}`)
      return []
    }

    // www.bloc.jp/barisshee/ は EUC-JP エンコーディングのため TextDecoder で正しくデコード
    const buffer = await res.arrayBuffer()
    const html = new TextDecoder('euc-jp').decode(buffer)
    const $ = cheerio.load(html)
    const keywordLower = artistKeywords.map((kw) => kw.toLowerCase())
    const todayStr = new Date().toLocaleDateString('sv-SE')

    // ── アプローチ①: テーブル行をパース（旧形式対応・より柔軟に） ────────────
    $('tr').each((_, row) => {
      try {
        const cells = $(row).find('td')
        if (cells.length < 2) return

        // 「ライブ」または「LIVE」を含む行のみ処理（先頭セルまたは行全体）
        const firstCellText = cells.eq(0).text().trim().toLowerCase()
        const rowText = $(row).text()
        if (!firstCellText.includes('ライブ') && !firstCellText.includes('live')) return

        // 日付を任意のセルから探す（M/D 形式）
        let dateMatch: RegExpMatchArray | null = null
        for (let i = 0; i < Math.min(cells.length, 3); i++) {
          dateMatch = cells.eq(i).text().trim().match(/(\d{1,2})\/(\d{1,2})/)
          if (dateMatch) break
        }
        if (!dateMatch) return

        const month = Number(dateMatch[1])
        const day = Number(dateMatch[2])
        const date = resolveYear(month, day)
        if (!date) return

        // 行全体のテキストでキーワードマッチ
        const rowTextLower = normalizeSpaces(rowText).toLowerCase()
        const matched = keywordLower.some((kw) => rowTextLower.includes(kw))
        if (!matched) return

        const title = cells.length > 2
          ? normalizeSpaces(cells.eq(2).text()) || 'Bar Isshee ライブ'
          : 'Bar Isshee ライブ'
        const detailText = cells.length > 3
          ? normalizeSpaces(cells.eq(3).text())
          : normalizeSpaces(rowText)

        const timeMatch = detailText.match(/start\s*(\d{1,2}:\d{2})/i)
        const time = timeMatch ? timeMatch[1] : null

        const sourceHref =
          $(row).find('a[href*="/data"]').first().attr('href') ||
          $(row).find('a').first().attr('href') ||
          MAIN_URL
        const sourceUrl = sourceHref.startsWith('http')
          ? sourceHref
          : new URL(sourceHref, MAIN_URL).toString()

        events.push({
          title,
          venue: '千駄木 Bar Isshee',
          date,
          time,
          ticket_status: guessTicketStatus(detailText),
          source_url: sourceUrl,
          source_type: 'official_site',
          raw_text: `${title}\n${detailText}`.slice(0, 500),
        })
      } catch (e) {
        console.error('blocテーブルパースエラー:', e)
      }
    })

    // ── アプローチ②: イベントリンクを直接たどる ─────────────────────────────
    // www.bloc.jp/barisshee/ のテーブル形式で見つからない場合、
    // ページ内のイベント詳細リンクを取得して個別にパース
    if (events.length === 0) {
      console.log('bloc: テーブルパース0件 → イベントリンクを個別にたどります')
      const detailLinks = $('a')
        .toArray()
        .map(el => {
          const href = $(el).attr('href') || ''
          return href.startsWith('http') ? href : new URL(href, MAIN_URL).toString()
        })
        .filter(url =>
          url.includes('/barisshee/data') || url.includes('bloc.jp/event/')
        )
        .filter((url, idx, arr) => arr.indexOf(url) === idx) // 重複除去
        .slice(0, 30) // 最大30件

      console.log(`bloc: 詳細リンク ${detailLinks.length}件`)

      for (const detailUrl of detailLinks) {
        try {
          const res2 = await fetch(detailUrl, { headers })
          if (!res2.ok) continue

          const html2 = await res2.text()
          const $2 = cheerio.load(html2)

          // タイトルからの日付抽出（例: "05/31/2026 (Sun) [ライブ] ..."）
          const pageTitle = $2('title').text()
          const bodyText = $2('body').text()

          // MM/DD/YYYY 形式（bloc新サイト: "05/31/2026"）
          const newFmtMatch = pageTitle.match(/(\d{1,2})\/(\d{2})\/(\d{4})/)
          // M/D 形式（旧サイト）
          const oldFmtMatch = bodyText.match(/(\d{1,2})\/(\d{1,2})/)

          let date: string | null = null
          if (newFmtMatch) {
            const [, m, d, y] = newFmtMatch
            const candidate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
            if (candidate >= todayStr) date = candidate
          } else if (oldFmtMatch) {
            date = resolveYear(Number(oldFmtMatch[1]), Number(oldFmtMatch[2]))
          }
          if (!date) continue

          // キーワードマッチ
          const textLower = (pageTitle + ' ' + bodyText).toLowerCase()
          const matched = keywordLower.some((kw) => textLower.includes(kw))
          if (!matched) continue

          // 重複チェック
          if (events.some(e => e.date === date)) continue

          // 開演時間（"open HH:MM / start HH:MM" または "start HH:MM"）
          const timeMatch2 = bodyText.match(/start\s+(\d{1,2}:\d{2})/i) ||
            bodyText.match(/開演\s*(\d{1,2}:\d{2})/)
          const time = timeMatch2 ? timeMatch2[1] : null

          // タイトル整形
          const titleRaw = pageTitle
            .replace(/^bloc\s*[-:]\s*/i, '')
            .replace(/^\d{1,2}\/\d{2}\/\d{4}\s*\([^)]+\)\s*\[.*?\]\s*/, '')
            .split('@')[0]
            .trim()

          events.push({
            title: titleRaw || 'Bar Isshee ライブ',
            venue: '千駄木 Bar Isshee',
            date,
            time,
            ticket_status: guessTicketStatus(bodyText),
            source_url: detailUrl,
            source_type: 'official_site',
            raw_text: bodyText.slice(0, 500),
          })
        } catch (e) {
          console.error(`blocイベント詳細エラー (${detailUrl}):`, e)
        }
      }
    }
  } catch (e) {
    console.error('blocスクレイプエラー:', e)
  }

  console.log(`bloc: ${events.length}件取得`)
  return events
}

// ============================================================
// Peatix スクレイパー
// https://peatix.com/search?q=ダースレイダー
// 検索結果から今日以降のイベントを取得
// ============================================================
export async function scrapePeatix(keywords: string[]): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = []
  const todayStr = new Date().toLocaleDateString('sv-SE')

  for (const keyword of keywords) {
    try {
      const url = `https://peatix.com/search?q=${encodeURIComponent(keyword)}&l.address=Japan`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept-Language': 'ja,en-US;q=0.9',
        },
      })
      if (!res.ok) {
        console.error(`Peatixアクセスエラー: ${res.status}`)
        continue
      }

      const html = await res.text()
      const $ = cheerio.load(html)

      // Peatixの検索結果: イベントカードを取得
      $('[data-component="search-result-event-card"], .event-card, [class*="EventCard"], li[class*="event"]').each((_, el) => {
        try {
          const $el = $(el)
          const text = $el.text()
          const link = $el.find('a').first().attr('href') || ''
          const sourceUrl = link.startsWith('http') ? link : `https://peatix.com${link}`

          // 日付抽出（Peatixは「2026年5月31日」形式が多い）
          const dateMatch = text.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})/)
          if (!dateMatch) return

          const y = parseInt(dateMatch[1])
          const m = parseInt(dateMatch[2])
          const d = parseInt(dateMatch[3])
          const thisYear = new Date().getFullYear()
          if (y < thisYear || y > thisYear + 1) return

          const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          if (candidate < todayStr) return

          // キーワードがテキストに含まれているか確認
          const textLower = text.toLowerCase()
          const matched = keywords.some(kw => textLower.includes(kw.toLowerCase()))
          if (!matched) return

          // タイトルと会場
          const title = $el.find('[class*="title"], h3, h2').first().text().trim() || 'Peatixイベント'
          const venueEl = $el.find('[class*="venue"], [class*="location"]').first().text().trim()
          const venue = venueEl || '会場未定'

          events.push({
            title,
            venue,
            date: candidate,
            time: null,
            ticket_status: '要予約',
            source_url: sourceUrl,
            source_type: 'peatix',
            raw_text: text.slice(0, 500),
          })
        } catch (e) {
          console.error('Peatixカードパースエラー:', e)
        }
      })

      console.log(`Peatix「${keyword}」: ${events.length}件`)
    } catch (e) {
      console.error(`Peatixスクレイプエラー (${keyword}):`, e)
    }
  }

  // 重複除去
  const unique = events.filter((e, i, arr) =>
    arr.findIndex(x => x.date === e.date && x.venue === e.venue) === i
  )
  console.log(`Peatix合計: ${unique.length}件`)
  return unique
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

// 記事公開日を基準にイベントの年を確定する
// ルール：
//   - 記事のM/D ≦ イベントのM/D → 同じ年のイベント（例: 4月記事 → 5月のライブ）
//   - 記事のM/D > イベントのM/D → 年越しイベントの可能性あり（例: 12月記事 → 1月のライブ）だけ翌年も試す
// これにより「2025年5月の記事に書かれた6/15」が2026年6月に誤解されるのを防ぐ
function resolveYearFrom(
  month: number,
  day: number,
  postDate: Date,
  todayStr: string
): string | null {
  const postYear = postDate.getFullYear()
  const postMMDD = (postDate.getMonth() + 1) * 100 + postDate.getDate()
  const eventMMDD = month * 100 + day

  // 記事が直近90日以内の場合のみ翌年への繰り上げを許可
  // 古い記事（例: 2025年8月投稿）の日付（8/2）が2026年として誤解されるのを防ぐ
  const postIsRecent = (Date.now() - postDate.getTime()) < 90 * 24 * 60 * 60 * 1000

  const candidates = (eventMMDD < postMMDD && postIsRecent)
    ? [postYear, postYear + 1]  // 直近記事 + 年越し可能性あり（例: 12月記事 → 1月ライブ）
    : [postYear]                 // 同年のイベント（古い記事は翌年に繰り上げない）

  for (const year of candidates) {
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
