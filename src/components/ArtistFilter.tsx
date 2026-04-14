'use client'

import { Artist } from '@/types'

type Props = {
  artists: Artist[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

// アーティスト絞り込みタグコンポーネント
export default function ArtistFilter({ artists, selectedIds, onChange }: Props) {
  const toggleArtist = (id: string) => {
    if (selectedIds.includes(id)) {
      // 選択済みならオフにする
      onChange(selectedIds.filter((sid) => sid !== id))
    } else {
      // 未選択なら追加
      onChange([...selectedIds, id])
    }
  }

  const selectAll = () => onChange([])

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* 全件表示ボタン */}
      <button
        onClick={selectAll}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selectedIds.length === 0
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        すべて
      </button>

      {/* アーティストタグ */}
      {artists.map((artist) => (
        <button
          key={artist.id}
          onClick={() => toggleArtist(artist.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedIds.includes(artist.id)
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {artist.name}
        </button>
      ))}
    </div>
  )
}
