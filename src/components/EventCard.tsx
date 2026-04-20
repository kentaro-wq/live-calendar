'use client'

import { useState } from 'react'
import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Event, TicketStatus, Artist } from '@/types'

type Props = {
  event: Event
  artists: Artist[]
  isAdmin?: boolean
  onDelete?: (id: string) => void
  onUpdate?: (event: Event) => void
}

const TICKET_STATUSES: TicketStatus[] = ['チケット確認中', '要予約', '当日券あり', '予約不要', '完売']

function getTicketBadgeStyle(status: TicketStatus | null): string {
  switch (status) {
    case '予約不要': return 'bg-green-100 text-green-700'
    case '当日券あり': return 'bg-blue-100 text-blue-700'
    case '要予約': return 'bg-yellow-100 text-yellow-700'
    case '完売': return 'bg-red-100 text-red-600 line-through'
    case 'チケット確認中':
    default: return 'bg-gray-100 text-gray-500'
  }
}

// iCalendar のテキスト値をエスケープ
function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function downloadIcs(event: Event) {
  const date = event.date.replace(/-/g, '')
  // time が "19:00/19:30" 形式の場合はSTART（後者）を使う
  const rawTime = event.time?.includes('/') ? event.time.split('/')[1] : event.time
  const startTime = rawTime ? rawTime.replace(':', '') + '00' : null
  const isAllDay = !startTime

  const nextDay = (() => {
    const d = new Date(event.date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0].replace(/-/g, '')
  })()

  const dtStart = isAllDay ? `DTSTART;VALUE=DATE:${date}` : `DTSTART:${date}T${startTime}`
  const dtEnd   = isAllDay ? `DTEND;VALUE=DATE:${nextDay}` : `DTEND:${date}T235900`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//ライブカレンダー//JP',
    'BEGIN:VEVENT',
    `UID:${event.id}@live-calendar`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.venue)}`,
    event.source_url ? `URL:${event.source_url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.date}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function getSourceLabel(type: string | null): string {
  switch (type) {
    case 'peatix': return 'Peatix'
    case 'official_site': return '公式サイト'
    case 'x_twitter': return 'X（Twitter）'
    case 'venue_site': return '会場サイト'
    case 'manual': return '手動入力'
    default: return '情報元'
  }
}

function formatTime(time: string | null): string | null {
  if (!time) return null
  const parts = time.split('/')
  if (parts.length === 2) return `開場 ${parts[0]} / 開演 ${parts[1]}`
  return `開演 ${time}`
}

export default function EventCard({ event, artists, isAdmin, onDelete, onUpdate }: Props) {
  const eventDate = parse(event.date, 'yyyy-MM-dd', new Date())
  const updatedAt = new Date(event.updated_at)
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: event.title,
    venue: event.venue,
    date: event.date,
    open_time: event.time?.includes('/') ? event.time.split('/')[0] : '',
    time: event.time?.includes('/') ? event.time.split('/')[1] : (event.time ?? ''),
    ticket_status: event.ticket_status ?? 'チケット確認中',
    source_url: event.source_url ?? '',
    co_artist_ids: event.co_artist_ids ?? [],
  })

  const handleDelete = async () => {
    if (!confirm(`「${event.title}」を削除しますか？`)) return
    const res = await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' })
    if (res.ok) onDelete?.(event.id)
    else alert('削除に失敗しました')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const time = editForm.open_time && editForm.time
        ? `${editForm.open_time}/${editForm.time}`
        : (editForm.time || editForm.open_time || null)

      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id, ...editForm, time, co_artist_ids: editForm.co_artist_ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdate?.(data.event)
      setShowEdit(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // co_artist_ids に含まれるアーティスト名を表示
  const coArtists = artists.filter(a => (event.co_artist_ids ?? []).includes(a.id))

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {format(eventDate, 'M月d日（E）', { locale: ja })}
              </p>
              {event.time && (
                <p className="text-sm text-gray-500">{formatTime(event.time)}</p>
              )}
              <a
                href={`https://maps.apple.com/?q=${encodeURIComponent(event.venue)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-medium text-gray-700 mt-1 underline decoration-dotted underline-offset-2 hover:text-indigo-600"
              >
                {event.venue}
              </a>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {event.artists && (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {event.artists.name}
                </span>
              )}
              {coArtists.map(a => (
                <span key={a.id} className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {a.name}
                </span>
              ))}
              <button
                onClick={() => setShowEdit(true)}
                className="shrink-0 text-xs text-gray-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                ✏️
              </button>
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  削除
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-800 font-medium">{event.title}</p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {event.ticket_status && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTicketBadgeStyle(event.ticket_status)}`}>
                  {event.ticket_status}
                </span>
              )}
              {event.manually_edited && (
                <span className="px-2 py-1 rounded-full text-xs bg-amber-50 text-amber-600">編集済</span>
              )}
              <span className="text-xs text-gray-400 self-center">
                更新：{format(updatedAt, 'M/d HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadIcs(event)}
                className="text-xs text-green-600 hover:text-green-800 underline underline-offset-2 transition-colors"
              >
                📅 カレンダーに追加
              </button>
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
                >
                  {getSourceLabel(event.source_type)} →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 編集モーダル */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">イベントを編集</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">イベントタイトル</label>
              <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">会場</label>
              <input type="text" value={editForm.venue} onChange={e => setEditForm(p => ({ ...p, venue: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開場 OPEN</label>
                <input type="time" value={editForm.open_time} onChange={e => setEditForm(p => ({ ...p, open_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開演 START</label>
                <input type="time" value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">チケット状況</label>
              <select value={editForm.ticket_status} onChange={e => setEditForm(p => ({ ...p, ticket_status: e.target.value as TicketStatus }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                {TICKET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">情報元URL</label>
              <input type="url" value={editForm.source_url} onChange={e => setEditForm(p => ({ ...p, source_url: e.target.value }))}
                placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">共演アーティスト（複数選択可）</label>
              <div className="flex flex-wrap gap-2">
                {artists.filter(a => a.id !== event.artist_id && a.slug !== 'others').map(a => (
                  <label key={a.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.co_artist_ids.includes(a.id)}
                      onChange={e => {
                        const ids = e.target.checked
                          ? [...editForm.co_artist_ids, a.id]
                          : editForm.co_artist_ids.filter(id => id !== a.id)
                        setEditForm(p => ({ ...p, co_artist_ids: ids }))
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
