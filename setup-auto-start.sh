#!/bin/bash

# macOS起動時に自動的に開発サーバーを起動する設定スクリプト

# カラー出力用の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 開発サーバー自動起動設定を開始します...${NC}"

# macOSかどうか確認
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ このスクリプトはmacOS専用です${NC}"
    exit 1
fi

# プロジェクトディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

echo -e "${GREEN}📁 プロジェクトディレクトリ: ${PROJECT_DIR}${NC}"

# 起動スクリプトのパス
START_SCRIPT="${PROJECT_DIR}/start-dev.sh"

# start-dev.shが存在しない場合は作成
if [ ! -f "$START_SCRIPT" ]; then
    echo -e "${YELLOW}📝 start-dev.shが見つかりません。作成します...${NC}"
    cat > "$START_SCRIPT" << 'EOF'
#!/bin/bash

# プロジェクトディレクトリに移動
cd "$(dirname "$0")"

# 現在のディレクトリを確認
echo "現在のディレクトリ: $(pwd)"

# 環境変数を確認
if [ ! -f ".env.local" ]; then
    echo "エラー: .env.local ファイルが見つかりません"
    exit 1
fi

# 依存関係を確認
if [ ! -d "node_modules" ]; then
    echo "依存関係をインストール中..."
    npm install
fi

# 開発サーバーを起動
echo "開発サーバーを起動中..."
npm run dev
EOF
    chmod +x "$START_SCRIPT"
    echo -e "${GREEN}✅ start-dev.shを作成しました${NC}"
fi

# LaunchAgentsディレクトリの確認
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
if [ ! -d "$LAUNCH_AGENTS_DIR" ]; then
    echo -e "${YELLOW}📁 LaunchAgentsディレクトリを作成します...${NC}"
    mkdir -p "$LAUNCH_AGENTS_DIR"
fi

# plistファイル名（プロジェクト名から生成）
PLIST_NAME="com.research-ai-tool.dev.plist"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${PLIST_NAME}"

# ユーザー名を取得
USER_NAME=$(whoami)

# plistファイルを作成
echo -e "${YELLOW}📝 plistファイルを作成します...${NC}"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.research-ai-tool.dev</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${START_SCRIPT}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/server.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/server-error.log</string>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

echo -e "${GREEN}✅ plistファイルを作成しました: ${PLIST_PATH}${NC}"

# 既存のサービスを停止（存在する場合）
if launchctl list | grep -q "com.research-ai-tool.dev"; then
    echo -e "${YELLOW}🛑 既存のサービスを停止します...${NC}"
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# サービスを読み込んで起動
echo -e "${YELLOW}🔄 サービスを読み込みます...${NC}"
launchctl load "$PLIST_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 自動起動設定が完了しました！${NC}"
    echo -e "${GREEN}📋 設定内容:${NC}"
    echo -e "   - 起動時に自動的に開発サーバーが起動します"
    echo -e "   - ログファイル: ${PROJECT_DIR}/server.log"
    echo -e "   - エラーログ: ${PROJECT_DIR}/server-error.log"
    echo ""
    echo -e "${YELLOW}💡 コマンド:${NC}"
    echo -e "   - サービスを停止: launchctl unload ${PLIST_PATH}"
    echo -e "   - サービスを開始: launchctl load ${PLIST_PATH}"
    echo -e "   - サービス状態確認: launchctl list | grep research-ai-tool"
    echo ""
    echo -e "${BLUE}🎉 次回の再起動から自動起動が有効になります！${NC}"
else
    echo -e "${RED}❌ サービスの読み込みに失敗しました${NC}"
    exit 1
fi


