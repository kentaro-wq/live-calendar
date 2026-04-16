import { Resend } from 'resend'
import { Event, Artist } from '@/types'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { createUnsubscribeToken } from '@/lib/unsubscribe-token'

// ビルド時ではなく実際に使うときにインスタンス化（環境変数未設定でもビルドが通る）
function getResend() {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key') {
    throw new Error('RESEND_API_KEY が設定されていません')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

type NotifyParams = {
  email: string
  newEvents: (Event & { artists?: Artist })[]
}

// 新着イベントをメールで通知する
export async function sendNewEventNotification({ email, newEvents }: NotifyParams) {
  if (newEvents.length === 0) return

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const unsubscribeToken = createUnsubscribeToken(email)

  // メール本文のHTMLを生成
  const eventsHtml = newEvents
    .map((event) => {
      const dateStr = format(new Date(event.date), 'M月d日（E）', { locale: ja })
      const artistName = event.artists?.name || '不明'
      return `
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <p style="font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 4px;">${dateStr} ${event.time ? event.time + '〜' : ''}</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 4px;">${event.venue}</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">${event.title}</p>
        <span style="background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 999px; font-size: 12px;">${artistName}</span>
        ${event.source_url ? `<br><a href="${event.source_url}" style="color: #4f46e5; font-size: 12px; margin-top: 8px; display: inline-block;">詳細を見る →</a>` : ''}
      </div>
    `
    })
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111827;">
      <h1 style="font-size: 20px; font-weight: bold; color: #4f46e5; margin-bottom: 4px;">🎤 ライブカレンダー</h1>
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">新着イベントのお知らせ</p>

      <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">
        ${newEvents.length}件の新着イベントが見つかりました
      </h2>

      ${eventsHtml}

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <a href="${appUrl}" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          カレンダーで全件を見る
        </a>
      </div>

      <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
        <a href="${appUrl}/notifications/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}" style="color: #9ca3af;">
          通知を解除する
        </a>
      </p>
    </body>
    </html>
  `

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `【ライブカレンダー】${newEvents.length}件の新着イベントがあります`,
    html,
  })

  if (error) {
    console.error(`メール送信エラー (${email}):`, error)
    throw new Error(`メール送信失敗: ${error.message}`)
  }

  return data
}
