#!/usr/bin/env tsx
/**
 * scripts/delete-old-events.ts
 *
 * 今日より前の日付のイベントをDBから一括削除するスクリプト。
 *
 * 使い方:
 *   npx tsx scripts/delete-old-events.ts          # ドライラン（削除対象を表示するだけ）
 *   npx tsx scripts/delete-old-events.ts --execute # 実際に削除
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
    if (key && !process.env[key]) {
      process.env[key] = val
    }
  }
}

const envPath = path.resolve(process.cwd(), '.env.local')
loadEnvFile(envPath)

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
  // 今日の日付（YYYY-MM-DD）
  const todayStr = new Date().toLocaleDateString('sv-SE')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  過去イベント 一括削除スクリプト')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  基準日（今日）: ${todayStr}`)
  console.log(`  モード        : ${isDryRun ? '🔍 ドライラン（表示のみ）' : '🗑️  実行（削除します）'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ─── 削除対象を取得 ────────────────────────────────────────────────────────
  const { data: targets, error: fetchError } = await supabase
    .from('events')
    .select('id, date, venue, title, artists(name)')
    .lt('date', todayStr)
    .order('date', { ascending: true })

  if (fetchError) {
    console.error('❌ イベント取得エラー:', fetchError.message)
    process.exit(1)
  }

  if (!targets || targets.length === 0) {
    console.log('✅ 削除対象の過去イベントはありません。')
    return
  }

  // ─── 対象件数の表示 ────────────────────────────────────────────────────────
  console.log(`📋 削除対象: ${targets.length} 件\n`)

  // 日付ごとにグループ表示
  const grouped: Record<string, typeof targets> = {}
  for (const ev of targets) {
    if (!grouped[ev.date]) grouped[ev.date] = []
    grouped[ev.date].push(ev)
  }

  for (const [date, evs] of Object.entries(grouped).sort()) {
    console.log(`  📅 ${date} (${evs.length}件)`)
    for (const ev of evs) {
      const artistName = (ev.artists as any)?.name ?? '?'
      console.log(`     - [${artistName}] ${ev.venue} / ${ev.title}`)
    }
  }
  console.log()

  // ─── ドライランは終了 ──────────────────────────────────────────────────────
  if (isDryRun) {
    console.log('ℹ️  ドライランのため削除は行いません。')
    console.log('   実際に削除するには --execute オプションを付けて実行してください:')
    console.log('   npx tsx scripts/delete-old-events.ts --execute\n')
    return
  }

  // ─── 削除確認プロンプト ────────────────────────────────────────────────────
  const confirmed = await confirm(
    `⚠️  上記 ${targets.length} 件を削除します。元に戻せません。続けますか？ [y/N] `
  )
  if (!confirmed) {
    console.log('キャンセルしました。')
    return
  }

  // ─── 削除実行 ──────────────────────────────────────────────────────────────
  const ids = targets.map((e) => e.id)

  // 1000件ずつバッチ削除（Supabase の IN 句の上限を考慮）
  const BATCH_SIZE = 500
  let deletedTotal = 0

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const { error: delError } = await supabase
      .from('events')
      .delete()
      .in('id', batch)

    if (delError) {
      console.error(`❌ 削除エラー (バッチ ${i / BATCH_SIZE + 1}):`, delError.message)
      process.exit(1)
    }
    deletedTotal += batch.length
    console.log(`  削除済み: ${deletedTotal} / ${targets.length} 件`)
  }

  console.log(`\n✅ 完了！${deletedTotal} 件の過去イベントを削除しました。`)
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
