-- ライブ情報カレンダーアプリ データベーススキーマ
-- Supabaseのダッシュボードで「SQL Editor」から実行してください

-- アーティストテーブル
CREATE TABLE IF NOT EXISTS artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URLに使う識別子（例: darth-reider）
  website_url TEXT,
  x_handle TEXT, -- Xのハンドル名（@なし）
  peatix_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベントテーブル
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT, -- "19:00" など文字列で保持（不明な場合はNULL）
  ticket_status TEXT CHECK (
    ticket_status IN ('予約不要', '当日券あり', '要予約', '完売', 'チケット確認中')
  ),
  source_url TEXT, -- 情報元のURL
  source_type TEXT CHECK (
    source_type IN ('peatix', 'official_site', 'x_twitter', 'venue_site', 'manual')
  ),
  raw_text TEXT, -- 取得した生テキスト（デバッグ用）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 重複チェック用インデックス（同じアーティスト・日付・会場の重複を防ぐ）
CREATE UNIQUE INDEX IF NOT EXISTS events_unique_idx
  ON events (artist_id, date, venue);

-- メール通知購読テーブル
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  artist_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE, -- 通知のオン/オフ
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 初期データ：アーティスト「ダースレイダー」
INSERT INTO artists (name, slug, x_handle, peatix_url)
VALUES (
  'ダースレイダー',
  'darth-reider',
  'DarthReider',
  'https://peatix.com/search?q=%E3%83%80%E3%83%BC%E3%82%B9%E3%83%AC%E3%82%A4%E3%83%80%E3%83%BC'
)
ON CONFLICT (slug) DO NOTHING;

-- Row Level Security（RLS）設定
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 全員が読み取り可能（公開カレンダーのため）
CREATE POLICY "誰でも閲覧可能" ON artists FOR SELECT USING (true);
CREATE POLICY "誰でも閲覧可能" ON events FOR SELECT USING (true);

-- 購読は本人のメールのみ閲覧・更新可能（簡易実装）
CREATE POLICY "購読の登録は誰でも可能" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "購読の閲覧は誰でも可能" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "購読の更新は誰でも可能" ON subscriptions FOR UPDATE USING (true);
