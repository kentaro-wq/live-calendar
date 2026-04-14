import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/subscriptions - メール通知購読を登録
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, artist_ids } = body

    // バリデーション
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'メールアドレスが無効です' },
        { status: 400 }
      )
    }
    if (!Array.isArray(artist_ids) || artist_ids.length === 0) {
      return NextResponse.json(
        { error: 'アーティストを1つ以上選択してください' },
        { status: 400 }
      )
    }

    // メールアドレスの簡易バリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 既存の購読があれば更新、なければ新規作成
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(
        { email, artist_ids, is_active: true },
        { onConflict: 'email' }
      )
      .select()
      .single()

    if (error) {
      console.error('購読登録エラー:', error)
      return NextResponse.json(
        { error: '登録に失敗しました。時間をおいて再試行してください' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('予期しないエラー:', e)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// DELETE /api/subscriptions?email=xxx - 購読解除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが指定されていません' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('email', email)

    if (error) {
      return NextResponse.json(
        { error: '解除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('予期しないエラー:', e)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
