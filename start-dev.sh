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

