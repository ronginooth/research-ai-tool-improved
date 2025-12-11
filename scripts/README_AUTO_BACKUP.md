# 自動バックアップシステム

このプロジェクトには、5分ごとに自動でGitバックアップを実行するシステムが設定されています。

## 📋 概要

- **実行間隔**: 5分ごと（300秒）
- **動作**: 変更がある場合のみ自動コミット
- **ログ**: `backup.log` と `backup-error.log` に記録

## 🔧 管理コマンド

### 状態確認
```bash
launchctl list | grep research-ai-tool
```

### 停止
```bash
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

### 再開
```bash
launchctl load ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

### 完全に削除
```bash
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
rm ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

## 📝 ログ確認

### バックアップログ
```bash
tail -f backup.log
```

### エラーログ
```bash
tail -f backup-error.log
```

## 🚀 手動実行

バックアップスクリプトを手動で実行することもできます：

```bash
bash scripts/periodic-backup.sh
```

## ⚙️ 設定変更

実行間隔を変更する場合は、`~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist` を編集：

```xml
<key>StartInterval</key>
<integer>300</integer>  <!-- 秒数（例: 300 = 5分、600 = 10分） -->
```

編集後、再読み込み：
```bash
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
launchctl load ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

## 📌 注意事項

- 自動バックアップは変更がある場合のみ実行されます
- 重要な変更は手動でコミットすることを推奨します（意味のあるコミットメッセージのため）
- `.gitignore` で除外されたファイル（`.env.local`、`node_modules/`など）はバックアップされません

---
最終更新: 2025-01-28 15:45:00 JST

