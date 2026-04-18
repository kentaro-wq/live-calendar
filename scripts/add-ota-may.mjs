import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => env.match(new RegExp(`${key}=(.+)`))?.[1]?.trim()

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

// オータコージのアーティストID取得
const artistRes = await fetch(`${SUPABASE_URL}/rest/v1/artists?slug=eq.ota-koji&select=id,name`, { headers })
const artists = await artistRes.json()
if (!artists.length) { console.error('オータコージが見つかりません'); process.exit(1) }
const artistId = artists[0].id
console.log(`アーティスト: ${artists[0].name} (${artistId})`)

const events = [
  {
    date: '2026-05-21',
    time: null,
    venue: '渋谷 ROOTS',
    title: '加藤雄一郎 鑑賞会 Trio w/ シラフくん、オータくん / DJ: Kunilopez',
    ticket_status: 'チケット確認中',
    source_type: 'x_twitter',
  },
  {
    date: '2026-05-27',
    time: '19:00',
    venue: '阿佐ヶ谷 MOGUMOGU',
    title: '夜久一 / ホメオスタシス（ヨオコ・ヨシノ・やまだ・SACHI-A）',
    ticket_status: '要予約',
    source_type: 'manual',
  },
]

let added = 0
for (const ev of events) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      artist_id: artistId,
      title: ev.title,
      venue: ev.venue,
      date: ev.date,
      time: ev.time,
      ticket_status: ev.ticket_status,
      source_url: null,
      source_type: ev.source_type,
      updated_at: new Date().toISOString(),
    }),
  })
  const data = await res.json()
  if (res.ok) {
    console.log(`✓ ${ev.date} ${ev.venue}`)
    added++
  } else {
    console.error(`✗ ${ev.date} ${ev.venue}:`, data)
  }
}
console.log(`\n完了: ${added}件追加`)
