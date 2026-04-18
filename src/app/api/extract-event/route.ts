import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
  }

  try {
    const { imageBase64, mediaType } = await request.json()
    if (!imageBase64) {
      return NextResponse.json({ error: '画像データが必要です' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `この画像はライブやイベントのフライヤー・告知画像です。
以下の情報をJSON形式で抽出してください。
情報がない場合はnullにしてください。

{
  "title": "イベント名やライブタイトル",
  "venue": "会場名（都市名+会場名が望ましい）",
  "date": "YYYY-MM-DD形式（例: 2026-05-21）",
  "time": "HH:MM形式の開演時間（例: 19:00）",
  "ticket_status": "予約不要/当日券あり/要予約/完売/チケット確認中 のいずれか"
}

JSONのみ返してください。説明文は不要です。`,
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
  } catch (e) {
    console.error('画像解析エラー:', e)
    return NextResponse.json({ error: '画像の解析に失敗しました' }, { status: 500 })
  }
}
