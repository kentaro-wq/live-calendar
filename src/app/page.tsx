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
  const [extracting, setExtracting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // 管理者ログインモーダル
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [form, setForm] = useState({
    artist_id: '',
    title: '',
    venue: '',
    date: '',
    open_time: '',
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

  const handleUpdate = (updated: Event) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ログインに失敗しました')
      setIsAdmin(true)
      setShowLoginModal(false)
      setLoginPassword('')
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('管理者モードからログアウトしますか？')) return
    try {
      await fetch('/api/admin/session', { method: 'DELETE' })
      setIsAdmin(false)
    } catch {
      // ignore
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setSubmitError(null)
    try {
      // Canvasで画像を圧縮（最大1200px・JPEG 80%）
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          const MAX = 1200
          const scale = Math.min(1, MAX / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round(img.width  * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
        }
        img.onerror = reject
        img.src = objectUrl
      })
      const res = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '読み取りに失敗しました')
      const ev = data.event
      setForm(p => ({
        ...p,
        title:         ev.title         ?? p.title,
        venue:         ev.venue         ?? p.venue,
        date:          ev.date          ?? p.date,
        open_time:     ev.open_time     ?? p.open_time,
        time:          ev.time          ?? p.time,
        ticket_status: ev.ticket_status ?? p.ticket_status,
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '画像の読み取りに失敗しました'
      alert(`エラー: ${msg}`)
      setSubmitError(msg)
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
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
        body: JSON.stringify({
          ...form,
          time: form.open_time && form.time
            ? `${form.open_time}/${form.time}`
            : (form.time || form.open_time || null),
          source_type: 'manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登録に失敗しました')
      setSubmitSuccess(`「${data.event.title}」を追加しました！`)
      const others = artists.find(a => a.slug === 'others')
      setForm({ artist_id: (others ?? artists[0])?.id || '', title: '', venue: '', date: '', open_time: '', time: '', ticket_status: 'チケット確認中', source_url: '' })
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
      // デフォルトは「その他」、なければ先頭アーティスト
      const others = artists.find(a => a.slug === 'others')
      setForm(prev => ({ ...prev, artist_id: (others ?? artists[0]).id }))
    }
  }, [artists])

  const filteredEvents = selectedArtistIds.length === 0
    ? events
    : events.filter((e) =>
        selectedArtistIds.includes(e.artist_id) ||
        (e.co_artist_ids ?? []).some(id => selectedArtistIds.includes(id))
      )

  const handleDateSelect = (date: Date) => {
    setSelectedDate((prev) =>
      prev?.toDateString() === date.toDateString() ? null : date
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
              <span aria-hidden>🎤</span>
              <span className="truncate">ライブカレンダー</span>
            </h1>
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              アーティストのイベント情報を自動収集
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <Link
                href="/admin/sns"
                title="SNS確認"
                aria-label="SNS確認"
                className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
              >
                📡
              </Link>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1 text-sm font-semibold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow transition-all"
            >
              <span aria-hidden>＋</span>
              <span className="hidden sm:inline">情報を追加</span>
              <span className="sm:hidden">追加</span>
            </button>
            <Link
              href="/notifications"
              title="通知設定"
              aria-label="通知設定"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              🔔
            </Link>
            {isAdmin ? (
              <button
                onClick={handleLogout}
                title="管理者ログアウト"
                aria-label="管理者ログアウト"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                🔓
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                title="管理者ログイン"
                aria-label="管理者ログイン"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                🔒
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
          </div>
        )}
        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm flex items-start gap-2">
            <span>✅</span>
            <span className="flex-1">{submitSuccess}</span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-100 border-t-indigo-500 animate-spin mb-4" />
            <p className="text-sm">イベント情報を読み込み中...</p>
          </div>
        )}

        {!loading && (
          <>
            <section className="space-y-2">
              <div className="flex items-baseline gap-2 px-1">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">絞り込み</h2>
                {selectedArtistIds.length > 0 && (
                  <span className="text-xs text-indigo-700 font-semibold">
                    {selectedArtistIds.length}組選択中
                  </span>
                )}
              </div>
              <ArtistFilter artists={artists} selectedIds={selectedArtistIds} onChange={setSelectedArtistIds} />
            </section>

            <section>
              <Calendar events={filteredEvents} onDateSelect={handleDateSelect} selectedDate={selectedDate} />
            </section>

            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="inline-block w-1 h-5 bg-indigo-500 rounded-full" aria-hidden />
                  {selectedDate
                    ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日のイベント`
                    : 'すべてのイベント'}
                </h2>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-gray-600 hover:text-indigo-700 underline underline-offset-2"
                  >
                    絞り込み解除
                  </button>
                )}
              </div>
              <EventList events={filteredEvents} artists={artists} selectedDate={selectedDate} isAdmin={isAdmin} onDelete={handleDelete} onUpdate={handleUpdate} />
            </section>

            <section className="pt-4 text-center">
              <Link
                href="/archive"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-700 underline underline-offset-4 decoration-dotted transition-colors"
              >
                📼 過去のライブを見る
              </Link>
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
            {/* 画像読み取りボタン */}
            <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-3 text-sm font-medium cursor-pointer transition-colors ${extracting ? 'border-indigo-300 bg-indigo-50 text-indigo-400' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600'}`}>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={extracting}
              />
              {extracting ? (
                <><span className="animate-spin">⏳</span> 画像を読み取り中...</>
              ) : (
                <><span>📷</span> フライヤー・スクショから自動入力</>
              )}
            </label>

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
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">日付 <span className="text-red-400">*</span></label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    min={todayStr} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開場 OPEN</label>
                  <input type="time" value={form.open_time} onChange={e => setForm(p => ({ ...p, open_time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">開演 START</label>
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

      {/* 管理者ログインモーダル */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">🔒 管理者ログイン</h2>
              <button
                type="button"
                onClick={() => { setShowLoginModal(false); setLoginError(null); setLoginPassword('') }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                ⚠️ {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">パスワード</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loggingIn ? '認証中...' : 'ログイン'}
            </button>
            <p className="text-xs text-gray-400 text-center">ログインすると、イベントの削除ができるようになります。</p>
          </form>
        </div>
      )}
    </div>
  )
}
