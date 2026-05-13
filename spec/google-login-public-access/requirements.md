# Google Login Public Access Requirements

## User Value

- 本番公開時に、利用者はGoogleアカウントで本人確認したうえでアプリを利用できる。
- 管理者は個人運用では単一メール制限を維持し、一般公開ではメール制限なしのGoogleログイン必須モードへ切り替えられる。
- 利用者に対して、Googleログイン情報やJ-Quants APIキーの扱いを明確に説明できる。

## Requirements

- `APP_AUTH_ENABLED=true` の場合、Googleログインを必須にする。
- `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` が設定されている場合、従来通りそのメールアドレスだけを許可する。
- `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` が未設定または空の場合、Google ID tokenの検証に成功した全Googleアカウントを許可する。
- `APP_AUTH_ENABLED=false` または未設定の場合、従来通りローカル開発向けに認証なしで利用できる。
- Google ID tokenは本人確認にのみ使い、パスワード、Google API access token、refresh tokenは取得しない。
- サーバー側でGoogle ID token、Google user profile、emailを永続保存しない。
- エラーメッセージにID tokenや個人情報を含めない。
- `/api/config` はGoogle Client IDと認証有効状態を返すが、認証tokenや個人情報は返さない。
- READMEに本番公開時の推奨設定を記載する。
  - `APP_AUTH_ENABLED=true`
  - `GOOGLE_CLIENT_ID=<client id>`
  - `ALLOWED_EMAIL` は一般公開時には未設定
- GitHub Actionsでは `ALLOWED_EMAIL` をoptional secretとして扱う。
  - `ALLOWED_EMAIL` が設定されている場合のみCloud Run環境変数へ渡す。
  - `ALLOWED_EMAIL` が未設定の場合はCloud Run環境変数へ設定せず、Googleログイン済み全員を許可する本番一般公開モードにする。
- READMEにGoogleログインで取得しない情報、利用する情報、保存しない情報を短く記載する。

## Out of Scope

- 独自ユーザーDB。
- セッション管理。
- ロール管理。
- 複数メールallowlist。
- Google Workspaceドメイン単位の制限。
- Google OAuth scope追加。
- Gmail、Drive等のGoogle API連携。

## Acceptance Criteria

- `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` 未設定で、有効なGoogle ID tokenならAPI利用が許可される。
- `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` 設定ありで、一致しないemailのtokenはHTTP 403になる。
- `APP_AUTH_ENABLED=true` で無効なtokenはHTTP 401になる。
- `APP_AUTH_ENABLED=false` ではtokenなしでAPI利用できる。
- Googleログインに関するREADME説明が、本番一般公開方針と一致している。
- GitHub Actionsで `ALLOWED_EMAIL` 未設定時にもdeployが失敗せず、Cloud Runへ空の `ALLOWED_EMAIL` を無理に渡さない。
- 既存のJ-Quants BYOキー、GCS cache、Cloud Run deploy設定を壊さない。
