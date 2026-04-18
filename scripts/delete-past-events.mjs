import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://puflmpqhpmjowbzvxnfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmxtcHFocG1qb3dienZ4bmZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA4MTY1OCwiZXhwIjoyMDkxNjU3NjU4fQ.ZH19U8rJPzZQdJ3ajpE6pnIYBcbhLPy3vWnAsT8CRUM'
)

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
