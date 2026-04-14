'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Artist } from '@/types'

export default function NotificationsPage() {
  const [email, setEmail] = useState('')
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [artists, setArtists] = useState<Artist[]>([])
  const [loadingArtists, setLoadingArtists] = useState(true)

  // Supabaseからアーティスト一覧を取得
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await fetch('/api/events')
        const data = await res.json()
        if (res.ok) setArtists(data.artists)
      } catch {
        // アーティスト取得失敗時は空のまま続行
      } finally {
        setLoadingArtists(false)
      }
    }
    fetchArtists()
  }, [])

  const toggleArtist = (id: string) => {
    setSelectedArtistIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email) {
      setError('メールアドレスを入力してください')
      return
    }
    if (selectedArtistIds.length === 0) {
      setError('通知を受け取りたいアーティストを1つ以上選択してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, artist_ids: selectedArtistIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登録に失敗しました')
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="戻る"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-gray-900">通知設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {success ? (
          /* 登録完了メッセージ */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
            <p className="text-4xl">✉️</p>
            <h2 className="text-xl font-bold text-gray-900">登録完了！</h2>
            <p className="text-gray-500 text-sm">
              {email} に新着イベントをお知らせします。
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              カレンダーに戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* メールアドレス入力 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900">メールアドレス</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>

            {/* アーティスト選択 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900">通知するアーティスト</h2>
              <p className="text-xs text-gray-400">選択したアーティストの新着イベントをお知らせします</p>
              <div className="space-y-2">
                {loadingArtists && (
                  <p className="text-sm text-gray-400">読み込み中...</p>
                )}
                {artists.map((artist) => (
                  <label
                    key={artist.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArtistIds.includes(artist.id)}
                      onChange={() => toggleArtist(artist.id)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-800">{artist.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '登録中...' : '通知を登録する'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              登録解除はメール内のリンクからいつでも可能です
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
