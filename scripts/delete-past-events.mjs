import { createClient } from '@supabase/supabase-js'

// 使い方: node --env-file=.env.local scripts/delete-past-events.mjs
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。')
  console.error('実行例: node --env-file=.env.local scripts/delete-past-events.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD

console.log(`今日: ${today}`)
console.log(`${today} より前のイベントを削除します...`)

// 削除前に確認
const { data: past, error: fetchErr } = await supabase
  .from('events')
  .select('date, venue, title')
  .lt('date', today)
  .order('date', { ascending: true })

if (fetchErr) {
  console.error('取得エラー:', fetchErr.message)
  process.exit(1)
}

if (!past || past.length === 0) {
  console.log('過去イベントは0件です。')
  process.exit(0)
}

console.log(`\n削除対象 (${past.length}件):`)
past.forEach(e => console.log(`  ${e.date} - ${e.venue} - ${e.title}`))

// 削除実行
const { error: deleteErr, count } = await supabase
  .from('events')
  .delete({ count: 'exact' })
  .lt('date', today)

if (deleteErr) {
  console.error('削除エラー:', deleteErr.message)
  process.exit(1)
}

console.log(`\n✅ ${count}件の過去イベントを削除しました。`)
