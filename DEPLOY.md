# デプロイ手順

## Vercel へのデプロイ

### 1. GitHub リポジトリの作成

1. [GitHub](https://github.com)にアクセス
2. 新しいリポジトリ `research-ai-tool-improved` を作成
3. Public リポジトリに設定

### 2. Personal Access Token の作成

1. [GitHub](https://github.com) にログイン
2. 右上のプロフィールアイコンをクリック
3. 「Settings」を選択
4. 左メニューから「Developer settings」を選択
5. 左メニューから「Personal access tokens」を選択
6. 「Tokens (classic)」を選択
7. 「Generate new token」 > 「Generate new token (classic)」をクリック
8. Note: `research-ai-tool` など適当な名前を入力
9. Expiration: 90 days など適当な期限を設定
10. Select scopes: `repo` にチェック（すべてのチェックボックスが選択されます）
11. 「Generate token」をクリック
12. **作成されたトークンをコピー（一度しか表示されません）**

### 3. ローカルからのプッシュ

```bash
cd /Users/makino/Documents/workspace_cursor/Research/Projects/AnswerThis/research-ai-tool-improved

# リモートURLを設定
git remote set-url origin https://github.com/ronginooth/research-ai-tool-improved.git

# プッシュ（パスワードの代わりにPersonal Access Tokenを使用）
git push -u origin main
# Username: ronginooth
# Password: <作成したPersonal Access Token>
```

### 4. Vercel でのデプロイ

#### 方法 1: vercel-env.json をインポート

1. [Vercel](https://vercel.com)にアクセス
2. GitHub アカウントでログイン
3. 「Add New Project」をクリック
4. `research-ai-tool-improved`リポジトリを選択
5. 環境変数のインポート:
   - 「Environment Variables」セクションを開く
   - 「Import」ボタンをクリック
   - `vercel-env.json` ファイルを選択
   - すべての環境変数が自動で設定されます
6. 「Deploy」をクリック

#### 方法 2: 手動で環境変数を設定

1. [Vercel](https://vercel.com)にアクセス
2. GitHub アカウントでログイン
3. 「Add New Project」をクリック
4. `research-ai-tool-improved`リポジトリを選択
5. 環境変数を設定（`ENV_VARIABLES.md`を参照）：
   - `GEMINI_API_KEY`: AIzaSyAs1RybWgIi6z1mT6VC25Ss5G-K25mxVN0
   - `NEXT_PUBLIC_SUPABASE_URL`: https://ryywrixjbqcltwujwbdd.supabase.co
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: （ENV_VARIABLES.md を参照）
   - `SUPABASE_SERVICE_ROLE_KEY`: （ENV_VARIABLES.md を参照）
6. 「Deploy」をクリック

### 5. デプロイ後の確認

デプロイが完了したら、Vercel から提供される URL でアクセスできます。

## 環境変数の設定

Vercel ダッシュボードで以下の環境変数を設定してください：

```
GEMINI_API_KEY=<Your Gemini API Key>
NEXT_PUBLIC_SUPABASE_URL=<Your Supabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Your Supabase Anon Key>
SUPABASE_SERVICE_ROLE_KEY=<Your Supabase Service Role Key>
```

---

最終更新: 2025-01-28 06:30:00 JST
