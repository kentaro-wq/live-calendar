import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    const payload = verifyUnsubscribeToken(token)

    if (!payload) {
      return NextResponse.json({ error: '無効な解除リンクです' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('email', payload.email)

    if (error) {
      console.error('配信停止更新エラー:', error)
      return NextResponse.json({ error: '配信停止に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('配信停止APIエラー:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
