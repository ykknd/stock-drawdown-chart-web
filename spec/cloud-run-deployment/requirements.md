# Cloud Run Deployment Requirements

## User Value

ローカルMVPをGoogle Cloud Runへ安全に公開し、意図したリリースタグだけで本番デプロイできる。

## Requirements

- 開発は `feat/host-gc` で行い、完成後に `main` へマージする。
- 本番デプロイは `main` 履歴上の `v*` タグでのみ実行する。
- GitHub ActionsはWorkload Identity Federationを使う。
- サービスアカウントキーは使わない。
- Cloud Runは `asia-northeast1`、サービス名 `stock-drawdown-chart-web` を基本とする。
- Cloud Runはunauthenticated accessを許可し、アプリ内Googleログインで `ALLOWED_EMAIL` のみ許可する。
- 公開Cloud Runでは `MARKET_DATA_PROVIDER=jquants` を使う。
- 公開Cloud Runでは共有 `JQUANTS_API_KEY` を設定せず、利用者が自身のJ-Quants APIキーを画面入力するBYOキー運用にする。
- 公開Cloud Runでは `MARKET_DATA_CACHE_BACKEND=gcs` を使い、Cloud Storageに日次マーケットデータキャッシュを保存する。
- J-Quants providerとGCS cacheの設定値はGitHub Repository VariablesからCloud Run環境変数へ渡す。
- READMEに必要なGitHub Secretsと推奨設定を記載する。

## Out of Scope

- 複数ユーザー管理。
- 課金・DB・監査ログ。
- 完全な無料保証。

## Acceptance Criteria

- `main` 以外のコミットに付いたタグではデプロイ前に失敗する。
- `main` 上の `v*` タグではテスト、ビルド、Cloud Run deployが実行される。
- 許可されたGoogleアカウントのみアプリを利用できる。
- Cloud Run runtimeではJ-Quants BYOキー運用になり、共有 `JQUANTS_API_KEY` が設定されない。
- Cloud Run runtimeではGCS cache用の環境変数が設定される。
