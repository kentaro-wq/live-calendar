'use client'

import { useState, useEffect } from 'react'
import { Artist, Event } from '@/types'
import Calendar from '@/components/Calendar'
import EventList from '@/components/EventList'
import ArtistFilter from '@/components/ArtistFilter'
import Link from 'next/link'

const TICKET_STATUSES = ['チケット確認中', '要予約', '当日券あり', '予約不要', '完売']

export default function Home() {
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState({
    artist_id: '',
    title: '',
    venue: '',
    date: '',
    time: '',
    ticket_status: 'チケット確認中',
    source_url: '',
  })

  const todayStr = new Date().toLocaleDateString('sv-SE')

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events?from=${todayStr}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'データの取得に失敗しました')
      const futureEvents = (data.events as Event[]).filter((e) => e.date >= todayStr)
      setEvents(futureEvents)
      setArtists(data.artists)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  useEffect(() => {
    fetch('/api/admin/session')
      .then(r => r.json())
      .then(d => setIsAdmin(Boolean(d.authenticated)))
      .catch(() => {})
  }, [])

  const handleDelete = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source_type: 'manual' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登録に失敗しました')
      setSubmitSuccess(`「${data.event.title}」を追加しました！`)
      setForm({ artist_id: artists[0]?.id || '', title: '', venue: '', date: '', time: '', ticket_status: 'チケット確認中', source_url: '' })
      setShowForm(false)
      fetchEvents()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '登録エラー')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (artists.length > 0 && !form.artist_id) {
      setForm(prev => ({ ...prev, artist_id: artists[0].id }))
    }
  }, [artists])

  const filteredEvents = selectedArtistIds.length === 0
    ? events
    : events.filter((e) => selectedArtistIds.includes(e.artist_id))

  const handleDateSelect = (date: Date) => {
    setSelectedDate((prev) =>
      prev?.toDateString() === date.toDateString() ? null : date
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🎤 ライブカレンダー</h1>
            <p className="text-xs text-gray-400">アーティストのイベント情報を自動収集</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin/sns" className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                SNS確認
              </Link>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              ＋ 情報を追加
            </button>
            <Link href="/notifications" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
              通知設定
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">⚠️ {error}</div>
        )}
        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm">✅ {submitSuccess}</div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-3 animate-pulse">🎵</p>
            <p className="text-sm">イベント情報を読み込み中...</p>
          </div>
        )}

        {!loading && (
          <>
            <section>
              <ArtistFilter artists={artists} selectedIds={selectedArtistIds} onChange={setSelectedArtistIds} />
            </section>
            <section>
              <Calendar events={filteredEvents} onDateSelect={handleDateSelect} selectedDate={selectedDate} />
            </section>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-800">
                  {selectedDate ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日のイベント` : 'すべてのイベント'}
                </h2>
                {selectedDate && (
                  <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    絞り込み解除
                  </button>
                )}
              </div>
              <EventList events={filteredEvents} selectedDate={selectedDate} isAdmin={isAdmin} onDelete={handleDelete} />
            </section>
          </>
        )}
      </main>

      {/* イベント追加モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">ライブ情報を追加</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">⚠️ {submitError}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">アーティスト</label>
                <select name="artist_id" value={form.artist_id} onChange={e => setForm(p => ({ ...p, artist_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required>
                  {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">イベントタイトル <span className="text-red-400">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="例: ダースレイダー ライブ" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">会場 <span className="text-red-400">*</span></label>
                <input type="text" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))}
                  placeholder="例: 新代田FEVER" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">日付 <span className="text-red-400">*</span></label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    min={todayStr} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開演時間</label>
                  <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">チケット状況</label>
                <select value={form.ticket_status} onChange={e => setForm(p => ({ ...p, ticket_status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {TICKET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">情報元URL（任意）</label>
                <input type="url" value={form.source_url} onChange={e => setForm(p => ({ ...p, source_url: e.target.value }))}
                  placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
                {submitting ? '追加中...' : 'カレンダーに追加する'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
