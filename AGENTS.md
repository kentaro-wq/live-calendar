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
