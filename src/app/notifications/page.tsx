'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Artist } from '@/types'

// メール通知の登録画面
// - ライトモード固定のデザイン。文字色は明示的に gray-900 系を置いて
//   OS がダークモードでも白背景に白文字にならないようにする。
// - ヒーロー＋カード2枚（メールアドレス / アーティスト選択）の構成。
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

  const toggleAll = () => {
    if (selectedArtistIds.length === artists.length) {
      setSelectedArtistIds([])
    } else {
      setSelectedArtistIds(artists.map((a) => a.id))
    }
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

  const allSelected = artists.length > 0 && selectedArtistIds.length === artists.length

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-600 hover:text-indigo-600 transition-colors text-base"
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
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-3xl">
              ✉️
            </div>
            <h2 className="text-2xl font-bold text-gray-900">登録完了！</h2>
            <p className="text-gray-700 text-sm">
              <span className="font-semibold text-gray-900">{email}</span>
              <br />
              に新着イベントをお知らせします。
            </p>
            <Link
              href="/"
              className="inline-block mt-4 text-sm bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 shadow-sm hover:shadow transition-all"
            >
              カレンダーに戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ヒーロー */}
            <section className="text-center pt-2 pb-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl mb-3 shadow-sm">
                🔔
              </div>
              <h2 className="text-xl font-bold text-gray-900">新着ライブをメールでお知らせ</h2>
              <p className="text-sm text-gray-600 mt-1.5">
                気になるアーティストを選ぶだけ。新しいイベントが入ったら届きます。
              </p>
            </section>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm flex items-start gap-2">
                <span>⚠️</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* メールアドレス入力 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <label htmlFor="email" className="text-sm font-semibold text-gray-900">
                  メールアドレス
                </label>
                <span className="text-xs text-gray-500">必須</span>
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {/* アーティスト選択 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">通知するアーティスト</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    選んだアーティストの新着イベントをお知らせします
                  </p>
                </div>
                {artists.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                  >
                    {allSelected ? 'すべて解除' : 'すべて選択'}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {loadingArtists && (
                  <p className="text-sm text-gray-500 py-2">読み込み中...</p>
                )}
                {!loadingArtists && artists.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">
                    登録されているアーティストがありません
                  </p>
                )}
                {artists.map((artist) => {
                  const checked = selectedArtistIds.includes(artist.id)
                  return (
                    <label
                      key={artist.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArtist(artist.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-gray-900 flex-1">
                        {artist.name}
                      </span>
                      {checked && (
                        <span className="text-xs text-indigo-700 font-semibold">選択中</span>
                      )}
                    </label>
                  )
                })}
              </div>
              {selectedArtistIds.length > 0 && (
                <p className="text-xs text-gray-600 pt-1">
                  <span className="font-semibold text-indigo-700">
                    {selectedArtistIds.length}組
                  </span>{' '}
                  のアーティストを選択中
                </p>
              )}
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
            >
              {submitting ? '登録中...' : '通知を登録する'}
            </button>

            <p className="text-xs text-gray-600 text-center leading-relaxed">
              登録解除はメール内のリンクからいつでも可能です。
              <br />
              メールアドレスは通知送信以外には使いません。
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
