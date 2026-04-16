'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token'), [searchParams])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnsubscribe = async () => {
    if (!token) {
      setError('解除リンクが不正です')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/subscriptions/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '配信停止に失敗しました')
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '配信停止に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">通知の配信停止</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {done ? (
            <>
              <p className="text-green-700 text-sm">配信停止が完了しました。</p>
              <Link
                href="/"
                className="inline-block text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                カレンダーに戻る
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                このメールアドレスへの新着通知を停止します。よろしければ実行してください。
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  ⚠️ {error}
                </div>
              )}

              <button
                onClick={handleUnsubscribe}
                disabled={submitting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? '停止中...' : '配信停止する'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
          読み込み中...
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  )
}
