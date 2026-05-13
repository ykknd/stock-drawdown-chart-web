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
- Cloud Runの環境変数でJ-Quants providerとGCS cacheを制御する。
- 公開環境では共有 `JQUANTS_API_KEY` を設定しない。
- Cloud Run runtime service accountは `stock-drawdown-runtime` を基本とし、GitHub Actions deploy時に `--service-account` で指定する。
- 最小運用は `min instances: 0`、`max instances: 1` とする。

## GCP IaC

- `infra/gcp` にTerraform定義を置く。
- Terraformで必要API、Artifact Registry、GCS cache bucket、lifecycle rule、deploy service account、runtime service account、Workload Identity Federation、IAMを作成する。
- Terraform outputsをGitHub Secrets / Variables設定に使う。
- Google OAuth Client IDは手動作成し、`GOOGLE_CLIENT_ID` としてGitHub Secretsへ設定する。

## Secrets

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GOOGLE_CLIENT_ID`
- `ALLOWED_EMAIL`

## Repository Variables

- `MARKET_DATA_PROVIDER`: `jquants`
- `MARKET_DATA_CACHE_BACKEND`: `gcs`
- `MARKET_DATA_CACHE_GCS_BUCKET`: cache用Cloud Storage bucket名
- `MARKET_DATA_CACHE_GCS_PREFIX`: `market-data-cache`

## Cloud Storage Cache

- cache bucketはTerraformで作成する。
- cache bucketにはTerraformで1日削除のObject Lifecycle ruleを設定する。
- lifecycle削除は非同期であり、即時削除を保証しない。
- Cloud Run runtime service accountにはcache bucketへの最小限のobject read/write権限を付与する。
