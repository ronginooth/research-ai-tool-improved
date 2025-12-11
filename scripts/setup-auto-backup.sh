#!/bin/bash

# 自動バックアップセットアップスクリプト
# macOSのLaunchAgentを使用して5分ごとに自動バックアップを実行

set -e

# プロジェクトのルートディレクトリ
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 自動バックアップセットアップを開始します..."
echo "📁 プロジェクトディレクトリ: $PROJECT_DIR"

# LaunchAgentの設定ファイルパス
PLIST_FILE="$HOME/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/periodic-backup.sh"

# 既存のLaunchAgentを停止（存在する場合）
if [ -f "$PLIST_FILE" ]; then
    echo "📋 既存のLaunchAgentを停止中..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm -f "$PLIST_FILE"
    echo "✅ 既存の設定を削除しました"
fi

# LaunchAgentの設定ファイルを作成
echo "📝 LaunchAgent設定ファイルを作成中..."
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.research-ai-tool.auto-backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$BACKUP_SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/backup.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/backup-error.log</string>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
</dict>
</plist>
EOF

# バックアップスクリプトに実行権限を付与
chmod +x "$BACKUP_SCRIPT"

# LaunchAgentを読み込む
echo "🔄 LaunchAgentを読み込み中..."
launchctl load "$PLIST_FILE"

# 動作確認
sleep 1
if launchctl list | grep -q "com.research-ai-tool.auto-backup"; then
    echo "✅ 自動バックアップ設定完了！"
    echo ""
    echo "📋 設定内容:"
    echo "   - 実行間隔: 5分ごと（300秒）"
    echo "   - バックアップスクリプト: $BACKUP_SCRIPT"
    echo "   - ログファイル: $PROJECT_DIR/backup.log"
    echo "   - エラーログ: $PROJECT_DIR/backup-error.log"
    echo ""
    echo "🔧 管理コマンド:"
    echo "   - 停止: launchctl unload $PLIST_FILE"
    echo "   - 開始: launchctl load $PLIST_FILE"
    echo "   - 状態確認: launchctl list | grep research-ai-tool"
    echo ""
    echo "📝 ログ確認:"
    echo "   - tail -f $PROJECT_DIR/backup.log"
else
    echo "❌ LaunchAgentの読み込みに失敗しました"
    exit 1
fi

