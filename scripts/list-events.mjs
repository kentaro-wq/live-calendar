import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://puflmpqhpmjowbzvxnfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmxtcHFocG1qb3dienZ4bmZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA4MTY1OCwiZXhwIjoyMDkxNjU3NjU4fQ.ZH19U8rJPzZQdJ3ajpE6pnIYBcbhLPy3vWnAsT8CRUM'
)

const { data, error } = await supabase
  .from('events')
  .select('date, venue, title')
  .order('date', { ascending: true })

if (error) { console.error(error.message); process.exit(1) }

console.log(`全イベント (${data.length}件):`)
data.forEach(e => console.log(`  ${e.date}  ${e.venue}  ${e.title}`))
