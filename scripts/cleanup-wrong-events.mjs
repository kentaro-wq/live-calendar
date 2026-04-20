import { createClient } from '@supabase/supabase-js'

// 使い方: node --env-file=.env.local scripts/cleanup-wrong-events.mjs
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。')
  console.error('実行例: node --env-file=.env.local scripts/cleanup-wrong-events.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// 2026-05-31 (Bar Isshee) 以外を削除
const { data: before } = await supabase.from('events').select('date, venue, title')
console.log('削除前:', before)

const { error } = await supabase
  .from('events')
  .delete()
  .neq('date', '2026-05-31')

if (error) { console.error('削除エラー:', error.message); process.exit(1) }

const { data: after } = await supabase.from('events').select('date, venue, title')
console.log('\n削除後:', after)
console.log('✅ 完了')
