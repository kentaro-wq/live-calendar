'use client'

import { format, isSameDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Event } from '@/types'
import EventCard from './EventCard'

type Props = {
  events: Event[]
  selectedDate: Date | null
}

// イベント一覧コンポーネント
export default function EventList({ events, selectedDate }: Props) {
  // 選択した日付があればその日のイベントだけ表示、なければすべて表示
  const filteredEvents = selectedDate
    ? events.filter((e) => isSameDay(new Date(e.date), selectedDate))
    : events

  // 日付順にグループ化
  const grouped = filteredEvents.reduce<Record<string, Event[]>>((acc, event) => {
    const key = event.date
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  if (sortedDates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">🎵</p>
        <p className="text-base">
          {selectedDate
            ? `${format(selectedDate, 'M月d日', { locale: ja })}はイベントなし`
            : 'イベントが見つかりませんでした'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 日付ごとにグループ表示 */}
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          {/* 日付ヘッダー */}
          <h3 className="text-sm font-bold text-gray-500 mb-2 px-1">
            {format(new Date(dateKey), 'M月d日（E）', { locale: ja })}
          </h3>
          <div className="space-y-3">
            {grouped[dateKey].map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
