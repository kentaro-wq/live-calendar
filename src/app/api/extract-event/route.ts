import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'APIキー未設定 (ANTHROPIC_API_KEY)' }, { status: 500 })
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

  console.log(`画像解析開始: サイズ: ${Math.round(imageBase64.length * 0.75 / 1024)}KB`)

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

抽出ルール：
- title: 出演アーティスト名を「/」で区切って全員列挙（例: "ミヤウチモリヤ / きむらさとし / クラッシー / 高岡大祐 / 藤巻鉄郎"）。イベント名がある場合はイベント名を先頭に。
- venue: 会場名（地名＋会場名。例: "本八幡 cooljojo jazz+art"）
- date: 開催日をYYYY-MM-DD形式（例: "2026-05-17"）
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
    return NextResponse.json({ success: true, event: extracted })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('画像解析エラー:', msg)
    return NextResponse.json({ error: `解析失敗: ${msg}` }, { status: 500 })
  }
}
