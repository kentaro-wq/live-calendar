'use client'

import { useState, useEffect } from 'react'
import { Artist, Event } from '@/types'
import Calendar from '@/components/Calendar'
import EventList from '@/components/EventList'
import ArtistFilter from '@/components/ArtistFilter'
import Link from 'next/link'

export default function Home() {
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabaseからイベントとアーティストを取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        // ブラウザのローカル日付（YYYY-MM-DD）を取得して今日以降のイベントのみ取得
        const todayStr = new Date().toLocaleDateString('sv-SE')
        const res = await fetch(`/api/events?from=${todayStr}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'データの取得に失敗しました')
        // クライアント側でも念のため過去イベントを除外
        const futureEvents = (data.events as Event[]).filter((e) => e.date >= todayStr)
        setEvents(futureEvents)
        setArtists(data.artists)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        const res = await fetch('/api/admin/session')
        if (!res.ok) return
        const data = await res.json()
        setIsAdmin(Boolean(data.authenticated))
      } catch {
        // セッション確認に失敗した場合は非表示のまま
      }
    }

    checkAdminSession()
  }, [])

  // アーティスト絞り込みでイベントをフィルタ
  const filteredEvents =
    selectedArtistIds.length === 0
      ? events
      : events.filter((e) => selectedArtistIds.includes(e.artist_id))

  // 日付セルクリック時：同じ日を再クリックで絞り込み解除
  const handleDateSelect = (date: Date) => {
    setSelectedDate((prev) =>
      prev?.toDateString() === date.toDateString() ? null : date
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🎤 ライブカレンダー</h1>
            <p className="text-xs text-gray-400">アーティストのイベント情報を自動収集</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/sns"
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                SNS確認
              </Link>
            )}
            <Link
              href="/notifications"
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              通知設定
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-3 animate-pulse">🎵</p>
            <p className="text-sm">イベント情報を読み込み中...</p>
          </div>
        )}

        {!loading && (
          <>
        {/* アーティスト絞り込みタグ */}
        <section>
          <ArtistFilter
            artists={artists}
            selectedIds={selectedArtistIds}
            onChange={setSelectedArtistIds}
          />
        </section>

        {/* カレンダー */}
        <section>
          <Calendar
            events={filteredEvents}
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
          />
        </section>

        {/* イベントリスト */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">
              {selectedDate
                ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日のイベント`
                : 'すべてのイベント'}
            </h2>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                絞り込み解除
              </button>
            )}
          </div>
          <EventList events={filteredEvents} selectedDate={selectedDate} />
        </section>
          </>
        )}
      </main>
    </div>
  )
}
