import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Event, TicketStatus } from '@/types'

type Props = {
  event: Event
}

// チケット状況バッジの色を返す
function getTicketBadgeStyle(status: TicketStatus | null): string {
  switch (status) {
    case '予約不要':
      return 'bg-green-100 text-green-700'
    case '当日券あり':
      return 'bg-blue-100 text-blue-700'
    case '要予約':
      return 'bg-yellow-100 text-yellow-700'
    case '完売':
      return 'bg-red-100 text-red-600 line-through'
    case 'チケット確認中':
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

// 情報源の種別を日本語に変換
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

// イベントカードコンポーネント
export default function EventCard({ event }: Props) {
  const eventDate = new Date(event.date)
  const updatedAt = new Date(event.updated_at)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-3">
        {/* 上段：日付・時間・会場 */}
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

          {/* アーティスト名バッジ */}
          {event.artists && (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {event.artists.name}
            </span>
          )}
        </div>

        {/* イベントタイトル */}
        <p className="text-sm text-gray-800 font-medium">{event.title}</p>

        {/* 下段：チケット状況・更新日時・リンク */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {/* チケット状況バッジ */}
            {event.ticket_status && (
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTicketBadgeStyle(
                  event.ticket_status
                )}`}
              >
                {event.ticket_status}
              </span>
            )}
            {/* 更新日時 */}
            <span className="text-xs text-gray-400 self-center">
              更新：{format(updatedAt, 'M/d HH:mm')}
            </span>
          </div>

          {/* 情報元リンク */}
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
  )
}
