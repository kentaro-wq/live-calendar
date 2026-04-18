'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Artist } from '@/types'

export default function ArtistManagePage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    x_handle: '',
    peatix_url: '',
    website_url: '',
  })

  const fetchArtists = async () => {
    setLoading(true)
    const res = await fetch('/api/artists')
    const data = await res.json()
    setArtists(data.artists ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchArtists() }, [])

  // 名前からスラッグを自動生成
  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    setForm(p => ({ ...p, name, slug: autoSlug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`「${data.artist.name}」を追加しました！次のクロール時から自動収集されます`)
      setForm({ name: '', slug: '', x_handle: '', peatix_url: '', website_url: '' })
      fetchArtists()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登録エラー')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (artist: Artist) => {
    if (!confirm(`「${artist.name}」と関連イベントをすべて削除しますか？`)) return
    const res = await fetch(`/api/artists?id=${artist.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSuccess(`「${artist.name}」を削除しました`)
      fetchArtists()
    } else {
      setError('削除に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">アーティスト管理</h1>
            <p className="text-xs text-gray-400">追加・削除するとクロール対象が変わります</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/sns" className="text-sm text-gray-500 hover:text-gray-700 underline">
              ← SNS確認
            </Link>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
              トップ
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">⚠️ {error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm">✅ {success}</div>
        )}

        {/* 追加フォーム */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">アーティストを追加</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  アーティスト名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="例: 宇多田ヒカル"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  スラッグ（URL用）<span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="例: utada-hikaru"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  pattern="[a-z0-9-]+"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">X（Twitter）ハンドル</label>
              <input
                type="text"
                value={form.x_handle}
                onChange={e => setForm(p => ({ ...p, x_handle: e.target.value }))}
                placeholder="例: DarthReider（@なし）"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Peatix URL</label>
                <input
                  type="url"
                  value={form.peatix_url}
                  onChange={e => setForm(p => ({ ...p, peatix_url: e.target.value }))}
                  placeholder="https://peatix.com/..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">公式サイト URL</label>
                <input
                  type="url"
                  value={form.website_url}
                  onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700">
              💡 追加後は「SNS確認」画面からクロールを実行すると、すぐにイベントが収集されます
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? '追加中...' : 'アーティストを追加する'}
            </button>
          </form>
        </div>

        {/* アーティスト一覧 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            登録中のアーティスト
            <span className="ml-2 text-sm font-normal text-gray-400">{artists.length}件</span>
          </h2>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
          ) : (
            <div className="space-y-2">
              {artists.map(artist => (
                <div
                  key={artist.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{artist.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-gray-400 font-mono">{artist.slug}</span>
                      {artist.x_handle && (
                        <span className="text-xs text-gray-400">@{artist.x_handle}</span>
                      )}
                      {artist.peatix_url && (
                        <span className="text-xs text-indigo-400">Peatix</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(artist)}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-2 shrink-0"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
