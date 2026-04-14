// アーティスト
export type Artist = {
  id: string
  name: string
  slug: string
  website_url: string | null
  x_handle: string | null
  peatix_url: string | null
  created_at: string
}

// イベント
export type Event = {
  id: string
  artist_id: string
  title: string
  venue: string
  date: string // YYYY-MM-DD形式
  time: string | null
  ticket_status: TicketStatus | null
  source_url: string | null
  source_type: SourceType | null
  raw_text: string | null
  created_at: string
  updated_at: string
  // リレーション（JOINで取得する場合）
  artists?: Artist
}

// チケット状況
export type TicketStatus =
  | '予約不要'
  | '当日券あり'
  | '要予約'
  | '完売'
  | 'チケット確認中'

// 情報源の種別
export type SourceType = 'peatix' | 'official_site' | 'x_twitter' | 'venue_site' | 'manual'

// メール通知購読
export type Subscription = {
  id: string
  email: string
  artist_ids: string[]
  created_at: string
}

// カレンダー表示用
export type CalendarEvent = {
  date: string
  events: Event[]
}
