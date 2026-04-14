'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { Event } from '@/types'

type Props = {
  events: Event[]
  onDateSelect: (date: Date) => void
  selectedDate: Date | null
}

// 月カレンダーコンポーネント
export default function Calendar({ events, onDateSelect, selectedDate }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // 指定した日付にイベントがあるかチェック
  const hasEvent = (date: Date) =>
    events.some((event) => isSameDay(new Date(event.date), date))

  // カレンダーのセルを生成（前後月の日付を含む6週分）
  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const rows = []
    let day = calStart

    while (day <= calEnd) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const dayClone = day
        const isCurrentMonth = isSameMonth(day, currentMonth)
        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
        const isTodayDate = isToday(day)
        const hasEventOnDay = hasEvent(day)

        week.push(
          <div
            key={day.toString()}
            onClick={() => isCurrentMonth && onDateSelect(dayClone)}
            className={`
              relative flex flex-col items-center justify-start pt-1 pb-2 min-h-[52px] cursor-pointer
              transition-colors rounded-lg
              ${!isCurrentMonth ? 'opacity-30 cursor-default' : 'hover:bg-indigo-50'}
              ${isSelected ? 'bg-indigo-100' : ''}
            `}
          >
            {/* 日付数字 */}
            <span
              className={`
                text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                ${isTodayDate ? 'bg-indigo-600 text-white' : 'text-gray-700'}
              `}
            >
              {format(day, 'd')}
            </span>
            {/* イベントありドット */}
            {hasEventOnDay && isCurrentMonth && (
              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {week}
        </div>
      )
    }
    return rows
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      {/* ヘッダー：前月・月表示・翌月 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="前の月"
        >
          ‹
        </button>
        <h2 className="text-lg font-bold text-gray-800">
          {format(currentMonth, 'yyyy年 M月', { locale: ja })}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1
              ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}
            `}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div className="space-y-1">{renderCells()}</div>
    </div>
  )
}
