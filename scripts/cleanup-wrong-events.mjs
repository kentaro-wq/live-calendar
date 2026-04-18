import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://puflmpqhpmjowbzvxnfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmxtcHFocG1qb3dienZ4bmZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA4MTY1OCwiZXhwIjoyMDkxNjU3NjU4fQ.ZH19U8rJPzZQdJ3ajpE6pnIYBcbhLPy3vWnAsT8CRUM'
)

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
