#!/usr/bin/env tsx
/**
 * scripts/force-clear-all.ts
 *
 * DBのイベントテーブルを全件削除するスクリプト。
 * データベースを完全にリセットしたいときに使う（開発・テスト環境向け）。
 *
 * 使い方:
 *   npx tsx scripts/force-clear-all.ts          # ドライラン（件数確認のみ）
 *   npx tsx scripts/force-clear-all.ts --execute # 実際に全削除
 *
 * 必要な環境変数（.env.local から自動読み込み）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { createClient } from '@supabase/supabase-js'

// ─── .env.local の読み込み ───────────────────────────────────────────────────
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'))

// ─── 引数チェック ────────────────────────────────────────────────────────────
const isDryRun = !process.argv.includes('--execute')

// ─── Supabase クライアント ───────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 環境変数が不足しています。')
  console.error('   NEXT_PUBLIC_SUPABASE_URL および SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ─── メイン処理 ──────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  全イベント 強制一括削除スクリプト')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  モード: ${isDryRun ? '🔍 ドライラン（表示のみ）' : '🗑️  実行（全削除します）'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ─── 全件数を確認 ──────────────────────────────────────────────────────────
  const { count, error: countError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ カウント取得エラー:', countError.message)
    process.exit(1)
  }

  const total = count ?? 0

  if (total === 0) {
    console.log('✅ 削除対象のイベントはありません（テーブルが空です）。')
    return
  }

  // ─── アーティスト別の件数サマリーを表示 ───────────────────────────────────
  const { data: summary, error: sumError } = await supabase
    .from('events')
    .select('artists(name), date')
    .order('date', { ascending: true })

  if (!sumError && summary) {
    const grouped: Record<string, number> = {}
    for (const row of summary) {
      const name = (row.artists as any)?.name ?? '不明'
      grouped[name] = (grouped[name] ?? 0) + 1
    }
    console.log(`📋 削除対象: 合計 ${total} 件\n`)
    for (const [name, cnt] of Object.entries(grouped)) {
      console.log(`  ${name}: ${cnt} 件`)
    }
    // 日付範囲
    const dates = summary.map(r => r.date as string).sort()
    if (dates.length > 0) {
      console.log(`\n  日付範囲: ${dates[0]} 〜 ${dates[dates.length - 1]}`)
    }
    console.log()
  }

  // ─── ドライランは終了 ──────────────────────────────────────────────────────
  if (isDryRun) {
    console.log('ℹ️  ドライランのため削除は行いません。')
    console.log('   実際に削除するには --execute オプションを付けて実行してください:')
    console.log('   npx tsx scripts/force-clear-all.ts --execute\n')
    return
  }

  // ─── 削除確認プロンプト ────────────────────────────────────────────────────
  const confirmed = await confirm(
    `⚠️  全 ${total} 件を削除します。この操作は元に戻せません。本当に続けますか？ [y/N] `
  )
  if (!confirmed) {
    console.log('キャンセルしました。')
    return
  }

  // ─── 全件削除（バッチ処理） ────────────────────────────────────────────────
  let deleted = 0
  const BATCH_SIZE = 500

  while (true) {
    // IDを BATCH_SIZE 件取得して削除
    const { data: rows, error: fetchErr } = await supabase
      .from('events')
      .select('id')
      .limit(BATCH_SIZE)

    if (fetchErr) {
      console.error('❌ ID取得エラー:', fetchErr.message)
      process.exit(1)
    }
    if (!rows || rows.length === 0) break

    const ids = rows.map(r => r.id)
    const { error: delErr } = await supabase
      .from('events')
      .delete()
      .in('id', ids)

    if (delErr) {
      console.error('❌ 削除エラー:', delErr.message)
      process.exit(1)
    }

    deleted += ids.length
    console.log(`  削除済み: ${deleted} / ${total} 件`)

    if (ids.length < BATCH_SIZE) break
  }

  console.log(`\n✅ 完了！全 ${deleted} 件のイベントを削除しました。`)
}

// ─── ユーティリティ：確認プロンプト ──────────────────────────────────────────
function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

main().catch((e) => {
  console.error('予期しないエラー:', e)
  process.exit(1)
})
