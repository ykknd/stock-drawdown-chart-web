# Google Login Public Access Design

## Current Behavior

- フロントエンドはGoogle Identity ServicesからID tokenを受け取り、React stateに保持する。
- API呼び出し時に `Authorization: Bearer <ID token>` を付与する。
- バックエンドは `google.oauth2.id_token.verify_oauth2_token` でtokenを検証する。
- 現在は `ALLOWED_EMAIL` が必須で、emailが一致しない場合はHTTP 403を返す。

## Target Auth Modes

### Local / No Auth

- `APP_AUTH_ENABLED` がfalse扱いの場合。
- `require_user()` は `None` を返し、APIは従来通り利用可能。

### Private Single Email

- `APP_AUTH_ENABLED=true`
- `ALLOWED_EMAIL=<email>`
- Google ID token検証後、token claimsのemailが `ALLOWED_EMAIL` と一致した場合のみ許可する。

### Public Google Login

- `APP_AUTH_ENABLED=true`
- `ALLOWED_EMAIL` 未設定または空文字
- Google ID token検証に成功し、email claimが存在すれば許可する。
- email claimはアクセス判定のためにメモリ上で読むだけで永続保存しない。

## Backend

- `get_allowed_email()` は既存通り、空なら `None` を返す。
- `verify_google_token(token: str) -> str` を以下のように変更する。
  - `GOOGLE_CLIENT_ID` が未設定ならHTTP 500。
  - Google ID tokenを検証する。
  - email claimを取り出し、空ならHTTP 401。
  - `ALLOWED_EMAIL` が設定されている場合のみemail一致を確認する。
  - 一致しない場合はHTTP 403。
  - 設定されていない場合は検証済みemailを返す。
- 例外メッセージにtokenやclaims全体を含めない。

## Frontend

- 既存のGoogle Identity Services利用を維持する。
- パスワード入力、追加scope要求、Google API access token取得は追加しない。
- ログイン画面の説明文を必要なら微修正する。
  - 「Googleアカウントでログインしてください」程度に留める。
  - 詳細なセキュリティ説明はREADMEに置く。

## Documentation

- READMEのCloud Run / Google login説明を更新する。
- 一般公開時の推奨は `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` 未設定。
- 個人専用または限定運用時は `ALLOWED_EMAIL` を設定する。
- GitHub Secretsの整理は以下とする。
  - Required: `GOOGLE_CLIENT_ID`
  - Optional: `ALLOWED_EMAIL`
- GitHub Actions workflowでは `ALLOWED_EMAIL` が未設定の場合にCloud Runへ `ALLOWED_EMAIL` 環境変数を渡さない。
- `ALLOWED_EMAIL` が設定されている場合だけ、`--update-env-vars` または生成したenv vars文字列に `ALLOWED_EMAIL=<value>` を含める。
- Googleログインで取得しないものを明記する。
  - Googleパスワード
  - Google API access token
  - refresh token
  - Gmail/Drive等への権限
- Google ID tokenはサーバーで検証し、emailをアクセス判定に使うが永続保存しないことを明記する。

## Tests

- `verify_google_token` の分岐をunit testする。
- Google token検証関数はmockし、外部Google通信に依存しない。
- 既存の認証必須APIの挙動が変わらないことを確認する。
- workflowのshell構文は静的に確認し、`ALLOWED_EMAIL` optional化で必須secret前提の記述が残らないことを確認する。
