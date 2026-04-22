import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { enforceRateLimit } from '@/lib/rate-limit'

export const maxDuration = 30

// 画像サイズの上限（base64文字列の長さ）。約4MBの画像まで受け付ける。
const MAX_IMAGE_BASE64_LENGTH = 6_000_000

// JST（Asia/Tokyo）で YYYY-MM-DD を返す。Vercel の実行環境はUTCなので JST に寄せる。
function todayInJst(): { full: string; year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = Number(parts.find(p => p.type === 'year')?.value)
  const m = Number(parts.find(p => p.type === 'month')?.value)
  const d = Number(parts.find(p => p.type === 'day')?.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { full: `${y}-${pad(m)}-${pad(d)}`, year: y, month: m, day: d }
}

// 指定の MM-DD について、今日以降で最初に現れる年を返す。
// 例: 今日=2026-04-21, MM-DD=05-17 → 2026, MM-DD=03-10 → 2027
function nextOccurrenceYear(month: number, day: number, today: { year: number; month: number; day: number }): number {
  const cmp =
    month !== today.month
      ? month - today.month
      : day - today.day
  return cmp >= 0 ? today.year : today.year + 1
}

// Claude が年を読めずに過去(2020など)に落としてしまった時の安全網。
// 「今日から 60 日以上前」なら、年が欠落していたと判断して次の該当日へ繰り上げる。
function repairLikelyMissingYear(rawDate: string, today: { full: string; year: number; month: number; day: number }): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate)
  if (!m) return rawDate
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || !month || !day) return rawDate

  const extractedMs = Date.UTC(year, month - 1, day)
  const todayMs = Date.UTC(today.year, today.month - 1, today.day)
  const diffDays = Math.floor((todayMs - extractedMs) / (24 * 60 * 60 * 1000))
  if (diffDays < 60) return rawDate // 直近の過去や未来はそのまま信じる

  const fixedYear = nextOccurrenceYear(month, day, today)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${fixedYear}-${pad(month)}-${pad(day)}`
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'APIキー未設定 (ANTHROPIC_API_KEY)' }, { status: 500 })
  }

  // レート制限チェック（IPごとに 5回/分・30回/時間）
  const rateLimit = await enforceRateLimit(request, 'extract-event')
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.reason },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { 'Retry-After': String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    )
  }

  let imageBase64: string
  try {
    const body = await request.json()
    imageBase64 = body.imageBase64
  } catch {
    return NextResponse.json({ error: 'リクエストの解析に失敗しました' }, { status: 400 })
  }

  if (!imageBase64) {
    return NextResponse.json({ error: '画像データが空です' }, { status: 400 })
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json(
      { error: '画像サイズが大きすぎます。4MB以下の画像を使用してください。' },
      { status: 413 }
    )
  }

  console.log(`画像解析開始: サイズ: ${Math.round(imageBase64.length * 0.75 / 1024)}KB`)

  const today = todayInJst()

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `この画像は日本のライブ・音楽イベントのフライヤーまたは告知画像です。
画像から以下の情報を読み取り、JSONのみ返してください（説明文不要）。

参考情報：
- 今日の日付（JST）: ${today.full}

抽出ルール：
- title: 出演アーティスト名を「/」で区切って全員列挙（例: "ミヤウチモリヤ / きむらさとし / クラッシー / 高岡大祐 / 藤巻鉄郎"）。イベント名がある場合はイベント名を先頭に。
- venue: 会場名（地名＋会場名。例: "本八幡 cooljojo jazz+art"）
- date: 開催日をYYYY-MM-DD形式（例: "2026-05-17"）
  * 画像に「年」が書かれていない場合は、今日の日付（${today.full}）以降で最初に訪れるその月日を採用する。例: 今日が${today.full}で画像が「5/17」なら今日以降で次に来る5/17を使う。
  * 画像に和暦（令和など）がある場合は西暦に変換する。
  * 年が明示されていれば、それが過去でも未来でもその年をそのまま使う。
- open_time: OPEN/開場時刻をHH:MM形式（例: "19:00"）。なければnull。
- time: START/開演時刻をHH:MM形式（例: "19:30"）。なければnull。
- ticket_status: "要予約"/"当日券あり"/"予約不要"/"完売"/"チケット確認中"。CHARGE/料金記載あり→"当日券あり"、予約リンクあり→"要予約"。

{
  "title": "...",
  "venue": "...",
  "date": "YYYY-MM-DD",
  "open_time": "HH:MM or null",
  "time": "HH:MM or null",
  "ticket_status": "..."
}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '情報を読み取れませんでした' }, { status: 422 })
    }

    const extracted = JSON.parse(jsonMatch[0])

    // Claude が年を読めずに 2020 年などに落とした場合の安全網。
    // 60日以上過去の日付は「年が欠落していた」と判断して次の該当日へ繰り上げる。
    if (typeof extracted.date === 'string') {
      const repaired = repairLikelyMissingYear(extracted.date, today)
      if (repaired !== extracted.date) {
        console.log(`過去日付を次の該当日に補正: ${extracted.date} → ${repaired}`)
        extracted.date = repaired
      }
    }

    return NextResponse.json({ success: true, event: extracted })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('画像解析エラー:', msg)
    return NextResponse.json({ error: `解析失敗: ${msg}` }, { status: 500 })
  }
}
