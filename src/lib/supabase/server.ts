import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// サーバーサイド用Supabaseクライアント（Service Role Key使用）
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // サーバーコンポーネントからの呼び出し時はcookie設定を無視
          }
        },
      },
    }
  )
}

// 管理者権限用クライアント（CronJobやAPIルートで使用）
// Service Role Keyを使うため、クライアントサイドには絶対に渡さないこと
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
