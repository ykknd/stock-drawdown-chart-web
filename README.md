# Drawdown Board

日本株の銘柄リストから、1年分の調整後終値とdrawdownを表示するFastAPI + ReactのMVPです。

## Local Setup

```powershell
uv venv --python 3.13 .venv
uv sync
uv run uvicorn stock_drawdown_app:app --reload
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## API

- `GET /api/health`
- `POST /api/drawdowns`

```json
{
  "symbols": ["7203", "6758", "9984"],
  "period": "1y"
}
```

## Notes

株価データはプロトタイプ用途として `yfinance` 経由で取得します。一般公開・マネタイズ前には、データ利用条件と本番向けデータプロバイダーを再確認してください。

## Cloud Run Deployment

This repository is prepared for tag-based production deployment to Cloud Run from GitHub Actions.

### Local auth behavior

Authentication is disabled by default for local development.

```powershell
uv run uvicorn stock_drawdown_app:app --reload
```

To test production-like auth locally, set:

```powershell
$env:APP_AUTH_ENABLED="true"
$env:GOOGLE_CLIENT_ID="<google-oauth-client-id>"
$env:ALLOWED_EMAIL="<your-google-account-email>"
uv run uvicorn stock_drawdown_app:app --reload
```

## Market Data Provider

データ取得元を `yfinance` (デフォルト) または `J-Quants` から選択できます。

### yfinance (Default)

環境変数設定なし、または `MARKET_DATA_PROVIDER=yfinance` で動作します。

### J-Quants

`MARKET_DATA_PROVIDER=jquants` を設定します。

J-Quants APIキーは以下の優先順で解決されます。

1. サーバー環境変数 `JQUANTS_API_KEY`: ローカル起動やセルフホストで設定しておくと便利です。
2. 画面入力された一時APIキー: サーバーにキーが設定されていない場合、利用者が自身のAPIキーを入力して利用できます。

> [!WARNING]
> 公開サーバーに `JQUANTS_API_KEY` を設定すると、それは運営者の共有キーとして消費されます。通常、不特定多数が利用する公開サイトではサーバーキーを設定せず、利用者に自身のキーを入力させる運用を推奨します。

## Market Data Cache

外部APIの呼び出しを抑えるため、同日・同一provider・同一credential scope・同一銘柄の価格データをキャッシュできます。

```powershell
$env:MARKET_DATA_CACHE_BACKEND="memory" # memory, local, gcs
```

### Local cache

ローカル開発ではファイルキャッシュを使えます。

```powershell
$env:MARKET_DATA_CACHE_BACKEND="local"
$env:MARKET_DATA_CACHE_DIR="$env:LOCALAPPDATA\drawdown-chart\market-data-cache"
uv run uvicorn stock_drawdown_app:app --reload
```

`MARKET_DATA_CACHE_DIR` 未設定時は `%LOCALAPPDATA%\drawdown-chart\market-data-cache` を既定値として使います。

### Cloud Storage cache

Cloud Run公開環境では、コンテナのローカルファイルシステムを永続キャッシュとして使わず、Cloud Storageを使います。

```powershell
$env:MARKET_DATA_CACHE_BACKEND="gcs"
$env:MARKET_DATA_CACHE_GCS_BUCKET="<bucket-name>"
$env:MARKET_DATA_CACHE_GCS_PREFIX="market-data-cache"
```

Cloud Storageバケット側で、cache objectを1日で削除するライフサイクルルールを設定する運用を推奨します。Cloud Run公開用のGCPリソースは [`infra/gcp`](infra/gcp) のTerraformで作成できます。

J-Quantsのキャッシュはcredential scope単位で分離します。画面入力されたAPIキーはSHA-256 hashをscopeとして使い、APIキー生値はcache key、ファイル名、object名、cache本文、レスポンス、ログに保存しません。

### Google Cloud setup with Terraform

GCP側のArtifact Registry、Cloud Storage cache bucket、Workload Identity Federation、Service Account、IAMはTerraformで準備できます。

Terraform definition:

```text
infra/gcp/
├── README.md
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
└── terraform.tfvars.example
```

#### Manual prerequisites

事前に以下だけ手動で準備します。

- Google Cloud projectを作成または選択する。
- 課金を有効化する。
- Terraformをインストールする。
- Google Cloud CLIをインストールする。
- Google OAuth Client IDを作成する。
  - アプリのGoogleログイン用です。
  - 取得したclient IDを後でGitHub Secret `GOOGLE_CLIENT_ID` に設定します。

Terraform実行用にローカルでGoogle Cloudへ認証します。

```powershell
gcloud auth application-default login
gcloud config set project <project-id>
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com
```

#### Provision infrastructure

Terraform変数ファイルを作成します。

```powershell
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/terraform.tfvars
```

`infra/gcp/terraform.tfvars` を編集します。

```hcl
project_id   = "your-gcp-project-id"
github_owner = "your-github-owner"
github_repo  = "drawdown-chart"
```

インフラを作成します。

```powershell
cd infra/gcp
terraform init
terraform plan
terraform apply
terraform output
```

Terraformは主に以下を作成します。

- Required Google Cloud APIs
- Artifact Registry repository: `stock-drawdown`
- Cloud Storage cache bucket
- cache objectの1日削除lifecycle rule
- GitHub Actions deploy service account
- Cloud Run runtime service account: `stock-drawdown-runtime`
- Workload Identity Pool / Provider
- GitHub Actions OIDC用IAM binding
- Cloud Run runtime service accountのcache bucket read/write権限

Cloud Run service本体は、release tag push時にGitHub Actionsが作成または更新します。

### Required GitHub secrets

Add these in `GitHub repository Settings -> Secrets and variables -> Actions -> Repository secrets`.

- `GCP_PROJECT_ID`: your Google Cloud project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `terraform output -raw workload_identity_provider`
- `GCP_SERVICE_ACCOUNT`: `terraform output -raw deploy_service_account_email`
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `ALLOWED_EMAIL`: the only Google account allowed to use the app

### Required GitHub variables

Add these in `GitHub repository Settings -> Secrets and variables -> Actions -> Variables`.

- `MARKET_DATA_PROVIDER`: `jquants`
- `MARKET_DATA_CACHE_BACKEND`: `gcs`
- `MARKET_DATA_CACHE_GCS_BUCKET`: `terraform output -raw cache_bucket_name`
- `MARKET_DATA_CACHE_GCS_PREFIX`: `market-data-cache`

For public hosting, do not set `JQUANTS_API_KEY` on Cloud Run. Users should provide their own J-Quants API key in the web UI.

### Release flow

Development happens on `feat/host-gc`. Production deploys only from tags on `main`.

```powershell
git checkout main
git pull origin main
git tag v0.1.0
git push origin v0.1.0
```

The workflow verifies that the tag commit is included in `origin/main` before deploying.

## Specs

機能要件、設計方針、実施順、実装実績は [`spec/README.md`](spec/README.md) で管理します。
