#!/bin/bash

# Semantic Scholar APIキー更新スクリプト
# 使用方法: ./scripts/update-api-key.sh

echo "=========================================="
echo "Semantic Scholar APIキー更新スクリプト"
echo "=========================================="
echo ""

# .env.localファイルのパス
ENV_FILE=".env.local"

# .env.localファイルが存在するか確認
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.localファイルが見つかりません"
    echo "env.templateをコピーして.env.localを作成してください"
    exit 1
fi

echo "現在のAPIキー設定を確認中..."
if grep -q "SEMANTIC_SCHOLAR_API_KEY" "$ENV_FILE"; then
    CURRENT_KEY=$(grep "SEMANTIC_SCHOLAR_API_KEY" "$ENV_FILE" | cut -d= -f2)
    if [ -n "$CURRENT_KEY" ]; then
        KEY_PREFIX="${CURRENT_KEY:0:4}..."
        KEY_LENGTH=${#CURRENT_KEY}
        echo "✅ 現在のAPIキー: $KEY_PREFIX (長さ: $KEY_LENGTH文字)"
    else
        echo "⚠️  APIキーが設定されていません"
    fi
else
    echo "⚠️  SEMANTIC_SCHOLAR_API_KEYの設定が見つかりません"
fi

echo ""
echo "新しいAPIキーを入力してください:"
echo "(Semantic Scholarダッシュボードから取得: https://www.semanticscholar.org/product/api)"
read -p "APIキー: " NEW_KEY

if [ -z "$NEW_KEY" ]; then
    echo "❌ APIキーが入力されませんでした"
    exit 1
fi

# APIキーの長さを確認（通常40文字）
if [ ${#NEW_KEY} -lt 20 ]; then
    echo "⚠️  警告: APIキーが短すぎます（通常40文字程度）"
    read -p "続行しますか？ (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        echo "キャンセルしました"
        exit 1
    fi
fi

echo ""
echo "以下の内容で更新します:"
echo "  SEMANTIC_SCHOLAR_API_KEY=${NEW_KEY:0:4}...${NEW_KEY: -4}"
read -p "続行しますか？ (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "キャンセルしました"
    exit 1
fi

# .env.localファイルを更新
if grep -q "SEMANTIC_SCHOLAR_API_KEY" "$ENV_FILE"; then
    # 既存の行を更新
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^SEMANTIC_SCHOLAR_API_KEY=.*|SEMANTIC_SCHOLAR_API_KEY=$NEW_KEY|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|^SEMANTIC_SCHOLAR_API_KEY=.*|SEMANTIC_SCHOLAR_API_KEY=$NEW_KEY|" "$ENV_FILE"
    fi
else
    # 新規追加
    echo "" >> "$ENV_FILE"
    echo "# Semantic Scholar Graph API Key" >> "$ENV_FILE"
    echo "SEMANTIC_SCHOLAR_API_KEY=$NEW_KEY" >> "$ENV_FILE"
fi

echo ""
echo "✅ APIキーを更新しました"
echo ""
echo "次のステップ:"
echo "1. 開発サーバーを再起動してください"
echo "2. 以下のコマンドで動作確認:"
echo "   curl http://localhost:3000/api/test-semantic-key"
echo ""


