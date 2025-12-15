# Git自動バックアップシステム

## 概要

このプロジェクトでは、5分おきに自動的にGitリポジトリをバックアップするシステムが設定されています。

## 仕組み

- **実行間隔**: 5分おき（300秒）
- **実行方法**: macOSの`launchd`を使用
- **バックアップ先**: GitHubリポジトリ（origin）

## 動作内容

1. ローカルの変更を検出
2. 変更があれば自動的にコミット
3. GitHubにプッシュ

## ファイル構成

- **スクリプト**: `scripts/periodic-backup.sh`
- **launchd設定**: `~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist`
- **ログファイル**: 
  - `backup.log` - 正常ログ
  - `backup-error.log` - エラーログ

## 管理コマンド

### サービスの状態確認

```bash
launchctl list | grep research-ai-tool
```

### サービスの停止

```bash
launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

### サービスの開始

```bash
launchctl load ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
```

### 手動実行

```bash
bash scripts/periodic-backup.sh
```

## ログの確認

```bash
# 正常ログ
tail -f backup.log

# エラーログ
tail -f backup-error.log
```

## 注意事項

- 変更がない場合はスキップされます
- コミットメッセージは自動生成されます（`Auto backup: YYYY-MM-DD HH:MM:SS`）
- `.gitignore`で除外されているファイルはバックアップされません

## トラブルシューティング

### エラーが発生する場合

1. スクリプトの実行権限を確認
   ```bash
   chmod +x scripts/periodic-backup.sh
   ```

2. Gitリポジトリの状態を確認
   ```bash
   git status
   ```

3. リモートリポジトリの設定を確認
   ```bash
   git remote -v
   ```

### サービスが動作していない場合

1. launchdの設定を確認
   ```bash
   launchctl list | grep research-ai-tool
   ```

2. サービスを再起動
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
   launchctl load ~/Library/LaunchAgents/com.research-ai-tool.auto-backup.plist
   ```

---
最終更新: 2025-12-12 10:36:00 JST


