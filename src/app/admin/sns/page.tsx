'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Artist } from '@/types'

// XTimeline はウィンドウオブジェクトに依存するためSSRを無効化
const XTimeline = dynamic(() => import('@/components/XTimeline'), { ssr: false })

// ダースレイダー関連のSNS・情報源一覧
const SNS_LINKS = [
  { label: 'X @DarthReider（個人）', url: 'https://x.com/DarthReider', icon: '𝕏', color: 'hover:bg-gray-900 hover:text-white' },
  { label: 'X @darthbassons（バンド）', url: 'https://x.com/darthbassons', icon: '𝕏', color: 'hover:bg-gray-900 hover:text-white' },
  { label: 'Instagram @darthreider', url: 'https://www.instagram.com/darthreider/', icon: '📷', color: 'hover:bg-pink-500 hover:text-white' },
  { label: 'HOT GATE（公式サイト・ライブ情報）', url: 'https://hotgate.link/gigs', icon: '🌐', color: 'hover:bg-indigo-50 hover:text-indigo-700' },
  { label: 'YouTube', url: 'https://www.youtube.com/playlist?list=PL8Z_C6iqHSOVuqFdcMaMwC7OhPelMjM4k', icon: '▶', color: 'hover:bg-red-50 hover:text-red-600' },
  { label: 'Tunecore（DARTHREIDER）', url: 'https://www.tunecore.co.jp/artists/darthreider', icon: '🎵', color: 'hover:bg-indigo-50 hover:text-indigo-700' },
]

// チケット状況の選択肢
const TICKET_STATUSES = ['要予約', '当日券あり', '予約不要', '完売', 'チケット確認中']

// 情報源の種別
const SOURCE_TYPES = [
  { value: 'x_twitter', label: 'X（Twitter）' },
  { value: 'official_site', label: '公式サイト' },
  { value: 'peatix', label: 'Peatix' },
  { value: 'venue_site', label: '会場サイト' },
  { value: 'manual', label: 'その他' },
]

// 表示するXアカウント
const X_ACCOUNTS = [
  { username: 'DarthReider', label: '@DarthReider（個人）' },
  { username: 'darthbassons', label: '@darthbassons（バンド）' },
]

export default function SnsCheckPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [activeTab, setActiveTab] = useState<string>(X_ACCOUNTS[0].username)
  const [form, setForm] = useState({
    artist_id: '',
    title: '',
    venue: '',
    date: '',
    time: '',
    ticket_status: 'チケット確認中',
    source_url: '',
    source_type: 'x_twitter',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // アーティスト一覧を取得
  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        setArtists(d.artists || [])
        if (d.artists?.length > 0) {
          setForm(prev => ({ ...prev, artist_id: d.artists[0].id }))
        }
      })
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登録に失敗しました')

      setSuccess(`「${data.event.title}」を登録しました（${data.event.date}）`)
      // フォームを部分リセット（アーティストは維持）
      setForm(prev => ({
        ...prev,
        title: '',
        venue: '',
        date: '',
        time: '',
        ticket_status: 'チケット確認中',
        source_url: '',
        source_type: 'x_twitter',
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登録エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
              aria-label="カレンダーに戻る"
            >
              ←
            </Link>
            <div>
              <h1 className="text-base font-bold text-gray-900">SNS告知チェック</h1>
              <p className="text-xs text-gray-400">ツイートを確認してライブ情報を手動登録</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            カレンダーを見る →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* SNSリンク一覧 */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">情報源リンク</h2>
          <div className="flex flex-wrap gap-2">
            {SNS_LINKS.map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 transition-colors ${link.color}`}
              >
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </section>

        {/* レイアウト：左=SNSタイムライン、右=手動登録フォーム */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左：SNSタイムライン */}
          <section className="space-y-3">
            {/* タブ：XとInstagram */}
            <div className="flex flex-wrap gap-2">
              {X_ACCOUNTS.map(account => (
                <button
                  key={account.username}
                  onClick={() => setActiveTab(account.username)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === account.username
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  𝕏 {account.label}
                </button>
              ))}
              {/* Instagramは埋め込み不可のため外部リンクボタン */}
              <a
                href="https://www.instagram.com/darthreider/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white text-gray-600 border border-gray-200 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200"
              >
                📷 Instagram
              </a>
            </div>

            {/* Xタイムライン本体 */}
            {X_ACCOUNTS.map(account => (
              <div
                key={account.username}
                className={activeTab === account.username ? 'block' : 'hidden'}
              >
                <XTimeline
                  username={account.username}
                  height={620}
                  theme="light"
                />
              </div>
            ))}

            {/* Instagram補足（Instagramはiframe埋め込みが公式非対応のため外部リンクのみ） */}
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100 p-4 text-center space-y-2">
              <p className="text-sm font-medium text-gray-700">📷 Instagram @darthreider</p>
              <p className="text-xs text-gray-500">フォロワー1.3万 · 投稿1.3万件</p>
              <a
                href="https://www.instagram.com/darthreider/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
              >
                Instagramを開く →
              </a>
            </div>

            {/* 補足テキスト */}
            <p className="text-xs text-gray-400 text-center">
              告知を見つけたら、右の「手動登録」フォームに入力してください
            </p>
          </section>

          {/* 右：手動イベント登録フォーム */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 h-fit">
            <h2 className="text-base font-bold text-gray-900">ライブ情報を手動登録</h2>

            {/* 成功メッセージ */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
                ✅ {success}
              </div>
            )}
            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* アーティスト */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  アーティスト <span className="text-red-400">*</span>
                </label>
                <select
                  name="artist_id"
                  value={form.artist_id}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                >
                  {artists.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* タイトル */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  イベントタイトル <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="例: ダースレイダー ライブ at 下北沢"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                />
              </div>

              {/* 会場 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  会場 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="venue"
                  value={form.venue}
                  onChange={handleChange}
                  placeholder="例: 新代田FEVER"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                />
              </div>

              {/* 日付・時間（横並び） */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    日付 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開演時間</label>
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* チケット状況 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">チケット状況</label>
                <select
                  name="ticket_status"
                  value={form.ticket_status}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {TICKET_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 情報元 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">情報源</label>
                  <select
                    name="source_type"
                    value={form.source_type}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {SOURCE_TYPES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">情報元URL</label>
                  <input
                    type="url"
                    name="source_url"
                    value={form.source_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {/* 登録ボタン */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {submitting ? '登録中...' : 'カレンダーに追加する'}
              </button>
            </form>
          </section>
        </div>

        {/* 操作のヒント */}
        <section className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 text-sm text-indigo-700 space-y-1">
          <p className="font-medium">💡 使い方</p>
          <ol className="list-decimal list-inside space-y-0.5 text-indigo-600">
            <li>左のタイムラインでダースレイダーのライブ告知ツイートを確認</li>
            <li>告知を見つけたら右フォームに日付・会場・タイトルを入力</li>
            <li>ツイートのURLを「情報元URL」に貼り付けると後から確認できます</li>
            <li>「カレンダーに追加する」でカレンダーに即時反映</li>
          </ol>
        </section>
      </main>
    </div>
  )
}
