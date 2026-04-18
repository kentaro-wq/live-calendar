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

// アーティストID取得
const artistRes = await fetch(`${SUPABASE_URL}/rest/v1/artists?slug=eq.ota-koji&select=id,name`, { headers })
const artists = await artistRes.json()
if (!artists.length) { console.error('オータコージが見つかりません'); process.exit(1) }
const artistId = artists[0].id
console.log(`アーティスト確認: ${artists[0].name} (${artistId})`)

// 4月の未来イベント（4/18以降）
const events = [
  {
    date: '2026-04-21',
    venue: '湯島 道',
    title: 'オータコージ 4th w/ マサヤマヨウコ、ヤマトヤスオ、ヤマザキタケル',
  },
  {
    date: '2026-04-23',
    venue: '代々木上原 hako gallery',
    title: 'tatsu & cozy＋one #15 w/ tatsu、竹下勇馬',
  },
  {
    date: '2026-04-24',
    venue: '吉祥寺 MANDA-LA2',
    title: 'OishiiOishii / TONKO w/ TONKO、奥田敏朗',
  },
  {
    date: '2026-04-30',
    venue: '新宿 LOFT',
    title: 'DRIVE FROM 80s〜Day1（NON BAND）',
  },
]

let added = 0
for (const ev of events) {
  const body = {
    artist_id: artistId,
    title: ev.title,
    venue: ev.venue,
    date: ev.date,
    time: null,
    ticket_status: 'チケット確認中',
    source_url: null,
    source_type: 'manual',
    updated_at: new Date().toISOString(),
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
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
