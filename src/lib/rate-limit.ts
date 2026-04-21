import { createAdminClient } from '@/lib/supabase/server'

type RateLimitRule = {
  windowMs: number
  max: number
  label: string
}

const DEFAULT_RULES: RateLimitRule[] = [
  { windowMs: 60_000, max: 5, label: '1分あたり' },
  { windowMs: 60 * 60_000, max: 30, label: '1時間あたり' },
]

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: string; retryAfterSeconds?: number }

/**
 * IPアドレスごとのレート制限チェック。
 * 指定されたendpoint名で `api_rate_limits` テーブルにログを残し、
 * 最近のリクエスト数が閾値を超えていたらブロックする。
 *
 * デフォルト: 5回/分 + 30回/時間
 */
export async function enforceRateLimit(
  request: Request,
  endpoint: string,
  rules: RateLimitRule[] = DEFAULT_RULES
): Promise<RateLimitResult> {
  const clientIp = getClientIp(request)
  const supabase = createAdminClient()

  const now = new Date()

  for (const rule of rules) {
    const since = new Date(now.getTime() - rule.windowMs).toISOString()
    const { count, error } = await supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip', clientIp)
      .eq('endpoint', endpoint)
      .gte('created_at', since)

    if (error) {
      // テーブル未作成などでRate Limitが機能しない場合は
      // 正規ユーザーを巻き込まないようログだけ残してスルー
      console.warn('[rate-limit] チェック失敗:', error.message)
      return { ok: true }
    }

    if ((count ?? 0) >= rule.max) {
      return {
        ok: false,
        reason: `${rule.label}のリクエスト上限（${rule.max}回）に達しました。少し時間をおいてから再試行してください。`,
        retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
      }
    }
  }

  // 記録を追加（失敗してもリクエストは通す）
  const { error: insertError } = await supabase
    .from('api_rate_limits')
    .insert({ ip: clientIp, endpoint })
  if (insertError) {
    console.warn('[rate-limit] 記録失敗:', insertError.message)
  }

  return { ok: true }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // "client, proxy1, proxy2" の先頭がクライアント
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
