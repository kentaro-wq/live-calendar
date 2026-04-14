'use client'

import { useEffect, useRef } from 'react'

type Props = {
  username: string    // @なしのXユーザー名
  height?: number     // タイムラインの高さ（px）
  theme?: 'light' | 'dark'
}

// Xのタイムラインを埋め込むコンポーネント
// Twitter Widget JS（platform.twitter.com/widgets.js）を使用
// APIキー不要・公開アカウントのみ対応
export default function XTimeline({ username, height = 600, theme = 'light' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // すでにウィジェットが読み込まれている場合はそのまま使う
    const render = () => {
      if ((window as any).twttr?.widgets) {
        ;(window as any).twttr.widgets.load(containerRef.current)
      }
    }

    if ((window as any).twttr) {
      render()
      return
    }

    // widgets.jsがまだ読み込まれていなければ動的に追加
    const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.charset = 'utf-8'
      script.onload = render
      document.body.appendChild(script)
    } else {
      existingScript.addEventListener('load', render)
    }
  }, [username])

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-xl border border-gray-100">
      {/* Xウィジェットのアンカータグ（widgets.jsが変換してiframeにする） */}
      <a
        className="twitter-timeline"
        data-lang="ja"
        data-height={height}
        data-theme={theme}
        data-chrome="noheader nofooter noborders"
        href={`https://twitter.com/${username}`}
      >
        @{username} のツイートを読み込み中...
      </a>
    </div>
  )
}
