# Cloud Run Deployment Design

## Deployment Flow

1. `feat/host-gc` でCloud Run対応を開発する。
2. PRまたはmergeで `main` に取り込む。
3. `main` を最新化して `v*` タグを作成する。
4. GitHub Actionsがタグを検知してデプロイする。

## GitHub Actions

- triggerは `push` tags `v*` を基本とする。
- workflow内でタグcommitが `origin/main` の祖先であることを検証する。
- Workload Identity FederationでGCPへ認証する。

## Runtime

- React静的ファイルをFastAPIから配信する単一サービス構成。
- Cloud Runの環境変数でGoogleログインと許可メールを制御する。
- 最小運用は `min instances: 0`、`max instances: 1` とする。

## Secrets

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GOOGLE_CLIENT_ID`
- `ALLOWED_EMAIL`
