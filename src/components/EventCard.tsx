'use client'

import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Event, TicketStatus } from '@/types'

type Props = {
  event: Event
  isAdmin?: boolean
  onDelete?: (id: string) => void
}

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
  const startTime = event.time ? event.time.replace(':', '') + '00' : null
  const isAllDay = !startTime

  // 終日イベントのDTENDはiCalendar仕様で翌日
  const nextDay = (() => {
    const d = new Date(event.date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0].replace(/-/g, '')
  })()

  const dtStart = isAllDay ? `DTSTART;VALUE=DATE:${date}`          : `DTSTART:${date}T${startTime}`
  const dtEnd   = isAllDay ? `DTEND;VALUE=DATE:${nextDay}`         : `DTEND:${date}T235900`

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

export default function EventCard({ event, isAdmin, onDelete }: Props) {
  const eventDate = parse(event.date, 'yyyy-MM-dd', new Date())
  const updatedAt = new Date(event.updated_at)

  const handleDelete = async () => {
    if (!confirm(`「${event.title}」を削除しますか？`)) return
    const res = await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' })
    if (res.ok) onDelete?.(event.id)
    else alert('削除に失敗しました')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xl font-bold text-gray-900">
              {format(eventDate, 'M月d日（E）', { locale: ja })}
            </p>
            {event.time && (
              <p className="text-sm text-gray-500">{event.time}〜</p>
            )}
            <p className="text-base font-medium text-gray-700 mt-1">{event.venue}</p>
          </div>
          <div className="flex items-center gap-2">
            {event.artists && (
              <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {event.artists.name}
              </span>
            )}
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
  )
}
