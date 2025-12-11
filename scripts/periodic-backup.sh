#!/bin/bash

# 定期バックアップスクリプト
# 変更がある場合のみGitコミットを実行

# プロジェクトのルートディレクトリ（このスクリプトの場所から相対的に取得）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Gitリポジトリが初期化されているか確認
if [ ! -d ".git" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Gitリポジトリが初期化されていません。初期化をスキップします。"
    exit 0
fi

# 変更があるか確認
if [ -n "$(git status --porcelain)" ]; then
    # 変更されたファイルをステージング
    git add -A
    
    # コミットメッセージを生成（タイムスタンプ付き）
    COMMIT_MSG="Periodic backup: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # コミット実行
    git commit -m "$COMMIT_MSG" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ バックアップ完了: $COMMIT_MSG"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ バックアップ失敗"
    fi
else
    # 変更がない場合は何もしない（ログも出力しない）
    exit 0
fi

