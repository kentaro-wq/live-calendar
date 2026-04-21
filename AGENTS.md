<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 開発環境・デプロイ

- **エディタ**: Cursor（VSCode系UI）。ユーザーは主にSource ControlのGUIか、組み込みターミナルで作業。
- **ホスティング**: Vercel（プロジェクト: `live-calendar`）。`main` ブランチへのpushで自動デプロイ。
- **リポジトリ**: GitHub `kentaro-wq/live-calendar`。
- **ユーザー操作の前提**: コミット/push手順を案内するときは、**CursorのUI操作**と**ターミナルコマンド**の両方を提示するとスムーズ。ターミナル派のときはコピペしやすいように1ブロックにまとめる。
- **デプロイ確認**: `git log --oneline -3` でコミット確認後、Vercelの「展開」タブで最新デプロイの状態を見る流れが既に慣例。

# 使えるMCPコネクター

Coworkセッションから以下のMCPが直接叩ける。コピペ作業を減らすために積極的に使う。

- **Supabase MCP** (`mcp__c24192dc-...__*`): `apply_migration` でDDL、`execute_sql` で読み取り、`get_advisors` でRLSやsearch_path問題のLint、`list_tables`/`list_extensions` でスキーマ調査。プロジェクトID: `puflmpqhpmjowbzvxnfi`。
- **Vercel MCP** (`mcp__43c6487e-...__*`): `list_deployments` で本番反映の確認（BUILDING→READY）、`get_deployment_build_logs` でビルド失敗の原因調査。Project ID: `prj_I4FLOhX46HP0K1VZZTEtutfDbxJK`、Team ID: `team_9Z9CYyQKgFlm6Cr02YMAsJpY`（`.vercel/project.json` に記載あり）。
- **Computer use**: 画面操作。Terminal/IDE/Browserは**tier制限あり**（terminal=clickのみ、browser=readのみ）。Chrome操作は Claude in Chrome 拡張（`mcp__Claude_in_Chrome__*`）を使うと DOM 経由で精密に動かせる。

# Supabaseポリシー運用メモ

- `subscriptions`/`api_rate_limits` は **RLS有効・ポリシー無し**。つまりanon/authenticated キーからは触れず、APIは必ず `createAdminClient()`（Service Role Key）で書く。
- `events`/`artists` は **SELECTのみ公開**、書き込みは `createAdminClient()` 経由。
- トリガー関数の `search_path` は必ず `set search_path = public, pg_temp` を付ける（Supabase Advisor が警告する）。
- DDLはSupabase MCPの `apply_migration` 経由で入れる。そのまま `supabase_migrations` テーブルに履歴が残る。

# cron ジョブ（pg_cron）

- `cleanup-api-rate-limits`: 毎日 15:00 UTC（JST 0:00）に `api_rate_limits` の 30日超過行を削除。ジョブ確認は `select * from cron.job;`。

# アーキテクチャ要点

- 公開APIで Service Role Key が必要な場合は `/api/events` や `/api/subscriptions` のパターンに従う。レート制限が要る場合は `src/lib/rate-limit.ts` の `enforceRateLimit(request, 'endpoint-name')` をPOST/等の冒頭で呼ぶ。
- 日付は `YYYY-MM-DD` 文字列。「今日以降」は `?from=YYYY-MM-DD`、「昨日以前（archive用）」は `?from=&to=YYYY-MM-DD&order=desc`。空の `from=` を明示的に渡すと下限なしになる仕様。

# 動きの型

ユーザーへのコミット手順案内は **1ブロックに `cd` から `git push` までまとめた bashコマンド** が一番伝わる（`cd ~/live-calendar && git add ... && git commit ... && git push origin main` の形で1行でもいい）。Cursor GUIの手順は「試した方が早い」ときだけ提案する。
