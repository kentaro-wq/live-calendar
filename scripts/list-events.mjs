import { createClient } from '@supabase/supabase-js'

// 使い方: node --env-file=.env.local scripts/list-events.mjs
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。')
  console.error('実行例: node --env-file=.env.local scripts/list-events.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const { data, error } = await supabase
  .from('events')
  .select('date, venue, title')
  .order('date', { ascending: true })

if (error) { console.error(error.message); process.exit(1) }

console.log(`全イベント (${data.length}件):`)
data.forEach(e => console.log(`  ${e.date}  ${e.venue}  ${e.title}`))
