#!/bin/bash

# Git自動バックアップスクリプト
# 5分おきに実行され、変更があればGitHubにプッシュします

# カラー出力用の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# プロジェクトディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR" || {
    echo -e "${RED}❌ プロジェクトディレクトリに移動できません: $PROJECT_DIR${NC}" >&2
    exit 1
}

# ログファイルのパス
LOG_FILE="$PROJECT_DIR/backup.log"
ERROR_LOG="$PROJECT_DIR/backup-error.log"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$ERROR_LOG"
}

# Gitリポジトリかどうか確認
if [ ! -d ".git" ]; then
    log_error "Gitリポジトリではありません: $PROJECT_DIR"
    exit 1
fi

# リモートリポジトリの確認
if ! git remote get-url origin >/dev/null 2>&1; then
    log_error "リモートリポジトリ 'origin' が設定されていません"
    exit 1
fi

# 現在のブランチを取得
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    log_error "現在のブランチを取得できません"
    exit 1
fi

log "バックアップ開始 (ブランチ: $CURRENT_BRANCH)"

# 変更があるか確認
if git diff --quiet && git diff --cached --quiet; then
    # リモートとの差分を確認
    git fetch origin "$CURRENT_BRANCH" >/dev/null 2>&1
    
    LOCAL=$(git rev-parse "$CURRENT_BRANCH")
    REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
        log "リモートブランチが見つかりません。初回プッシュが必要です"
        # 初回プッシュ
        if git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
            log "✅ 初回プッシュ成功"
        else
            log_error "初回プッシュ失敗"
            exit 1
        fi
    elif [ "$LOCAL" = "$REMOTE" ]; then
        log "変更なし。スキップします"
        exit 0
    else
        log "リモートとの差分を検出。プッシュします"
    fi
else
    log "ローカルの変更を検出"
fi

# 変更をステージング
git add -A >> "$LOG_FILE" 2>> "$ERROR_LOG"

# コミットメッセージを生成
COMMIT_MSG="Auto backup: $(date '+%Y-%m-%d %H:%M:%S')"

# コミット（変更がある場合のみ）
if ! git diff --cached --quiet; then
    if git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
        log "✅ コミット成功: $COMMIT_MSG"
    else
        log_error "コミット失敗"
        exit 1
    fi
fi

# プッシュ
if git push origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>> "$ERROR_LOG"; then
    log "✅ プッシュ成功"
else
    log_error "プッシュ失敗"
    exit 1
fi

log "バックアップ完了"

