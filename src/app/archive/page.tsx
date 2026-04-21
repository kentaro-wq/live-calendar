'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Artist, Event } from '@/types'
import EventCard from '@/components/EventCard'
import ArtistFilter from '@/components/ArtistFilter'

// 過去のライブ一覧ページ
// /api/events に ?from=&to=<yesterday>&order=desc を投げて、昨日以前のイベントを
// 新しい月から順に月ごとにグループ化して表示する。
export default function ArchivePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // 「昨日」以前を過去扱いとする（今日のイベントはトップに残すため）
        const today = new Date()
        today.setDate(today.getDate() - 1)
        const toStr = today.toLocaleDateString('sv-SE')

        const res = await fetch(`/api/events?from=&to=${toStr}&order=desc`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'データの取得に失敗しました')
        setEvents(data.events as Event[])
        setArtists(data.artists as Artist[])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    load()

    // 管理者セッションだけは別途確認（過去イベントを編集できるように）
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.authenticated)))
      .catch(() => {})
  }, [])

  // アーティスト絞り込み（主催 or 共演どちらでもヒット）
  const filteredEvents = useMemo(() => {
    if (selectedArtistIds.length === 0) return events
    return events.filter(
      (e) =>
        selectedArtistIds.includes(e.artist_id) ||
        (e.co_artist_ids ?? []).some((id) => selectedArtistIds.includes(id))
    )
  }, [events, selectedArtistIds])

  // 月（YYYY-MM）ごとにグルーピング。events 自体が desc 順なので
  // グループ内も自然と新しい順になる。
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const ev of filteredEvents) {
      const monthKey = ev.date.slice(0, 7) // "YYYY-MM"
      const list = map.get(monthKey)
      if (list) list.push(ev)
      else map.set(monthKey, [ev])
    }
    return Array.from(map.entries()) // [ ["2026-03", [...]], ["2026-02", [...]] ]
  }, [filteredEvents])

  const handleDelete = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const handleUpdate = (updated: Event) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">📼 過去のライブ</h1>
            <p className="text-xs text-gray-400">アーカイブ（昨日以前のイベント）</p>
          </div>
          <Link
            href="/"
            className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-3 animate-pulse">🎵</p>
            <p className="text-sm">過去のライブを読み込み中...</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {artists.length > 0 && (
              <section>
                <ArtistFilter
                  artists={artists}
                  selectedIds={selectedArtistIds}
                  onChange={setSelectedArtistIds}
                />
              </section>
            )}

            {grouped.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🗃️</p>
                <p className="text-sm">過去のライブがまだありません</p>
              </div>
            ) : (
              <section className="space-y-8">
                {grouped.map(([monthKey, monthEvents]) => (
                  <div key={monthKey}>
                    <h2 className="text-base font-bold text-gray-500 mb-3 px-1">
                      {format(
                        parse(`${monthKey}-01`, 'yyyy-MM-dd', new Date()),
                        'yyyy年M月',
                        { locale: ja }
                      )}
                      <span className="text-xs text-gray-400 ml-2 font-normal">
                        {monthEvents.length}件
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {monthEvents.map((ev) => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          artists={artists}
                          isAdmin={isAdmin}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
