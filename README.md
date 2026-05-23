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

This repository is prepared for tag-based staging and production deployment to Cloud Run from GitHub Actions.

- staging: `stg-vX.Y.Z-rc.N`
- production: `vX.Y.Z`

Staging and production should use separate Google Cloud projects and separate GitHub Environments.

### Local auth behavior

Authentication is disabled by default for local development.

```powershell
uv run uvicorn stock_drawdown_app:app --reload
```

To test production-like auth locally, set:

```powershell
$env:APP_AUTH_ENABLED="true"
$env:GOOGLE_CLIENT_ID="<google-oauth-client-id>"
uv run uvicorn stock_drawdown_app:app --reload
```

With `APP_AUTH_ENABLED=true`, Google login is required. If `ALLOWED_EMAIL` is set, only that email address can use the app. If `ALLOWED_EMAIL` is not set, any user with a valid Google login can use the app.

```powershell
$env:ALLOWED_EMAIL="<your-google-account-email>" # optional, for private access
```

Google login is used only for identity verification. The app does not collect or store Google passwords, Google API access tokens, refresh tokens, or permissions for Gmail/Drive. The backend verifies the Google ID token and uses the verified email address only for access control.

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

Terraform変数ファイルとworkspaceは、staging / production で分けます。同じworkspaceで `staging.tfvars` と `production.tfvars` を切り替えないでください。

```powershell
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/staging.tfvars
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/production.tfvars
```

`infra/gcp/staging.tfvars` の例:

```hcl
project_id   = "stage-web-stock-drawdown"
github_owner = "ykknd"
github_repo  = "stock-drawdown-chart-web"
environment  = "staging"
```

`infra/gcp/production.tfvars` の例:

```hcl
project_id   = "<production-project-id>"
github_owner = "ykknd"
github_repo  = "stock-drawdown-chart-web"
environment  = "production"
```

staging のインフラを作成します。

```powershell
cd infra/gcp
terraform init
terraform workspace new staging
terraform workspace select staging
terraform plan -var-file="staging.tfvars"
terraform apply -var-file="staging.tfvars"
terraform output
```

production のインフラを扱う場合は、production workspace と `production.tfvars` を使います。

```powershell
cd infra/gcp
terraform init
terraform workspace new production
terraform workspace select production
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
terraform output
```

既にworkspaceが存在する場合、`terraform workspace new <name>` は失敗します。その場合は `terraform workspace select <name>` のみ実行してください。

Terraformは主に以下を作成します。

- Required Google Cloud APIs
- Artifact Registry repository
- Forecast Artifact Registry repository
- Cloud Storage cache bucket
- cache objectの1日削除lifecycle rule
- GitHub Actions deploy service account
- Cloud Build build service account
- Cloud Run runtime service account
- Forecast runtime service account
- Private Forecast Cloud Run service
- Workload Identity Pool / Provider
- GitHub Actions OIDC用IAM binding
- Cloud Run runtime service accountのcache bucket read/write権限
- Web runtime service accountからForecast serviceへのinvoke権限
- Cloud Build service accountのsource archive read、build log、Artifact Registry push権限
- GitHub Actions deploy service accountがCloud Build service accountをactAsする権限

Cloud Run service本体は、release tag push時にGitHub Actionsが作成または更新します。

`gcloud builds submit` で `PROJECT_NUMBER-compute@developer.gserviceaccount.com does not have storage.objects.get access` が出る場合は、Cloud Build default service accountの権限不足です。最新の `infra/gcp` を反映して `terraform apply` を再実行してください。

`caller does not have permission to act as service account` が出る場合は、GitHub Actions deploy service accountがCloud Build default service accountをactAsする権限不足です。最新の `infra/gcp` を反映して `terraform apply` を再実行してください。

Cloud Build作成後にログストリーミング権限で失敗する場合があるため、GitHub Actionsでは `gcloud builds submit --async` でbuildを作成し、`gcloud builds describe` でステータスをポーリングします。詳細ログはGitHub Actions出力に表示されるCloud Build URLから確認してください。

### Required GitHub Environments

Create these in `GitHub repository Settings -> Environments`.

- `staging`
- `production`

Add the following secrets and variables to each environment. Production should use an environment protection rule such as required reviewers.

Environment secrets:

- `GCP_PROJECT_ID`: your Google Cloud project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `terraform output -raw workload_identity_provider`
- `GCP_SERVICE_ACCOUNT`: `terraform output -raw deploy_service_account_email`
- `GOOGLE_CLIENT_ID`: Google OAuth client ID

Optional environment secret:

- `ALLOWED_EMAIL`: set only for private single-email access. Leave unset for public hosting where any verified Google account may use the app.

Environment variables:

- `REGION`: `asia-northeast1`
- `WEB_SERVICE`: `terraform output -raw web_service_name`
- `FORECAST_SERVICE`: `terraform output -raw forecast_service_name`
- `WEB_ARTIFACT_REPOSITORY`: `terraform output -raw artifact_repository`
- `FORECAST_ARTIFACT_REPOSITORY`: `terraform output -raw forecast_artifact_repository`
- `CLOUD_BUILD_SERVICE_ACCOUNT`: `terraform output -raw cloud_build_service_account_email`
- `WEB_RUNTIME_SERVICE_ACCOUNT`: `terraform output -raw runtime_service_account_email`
- `FORECAST_RUNTIME_SERVICE_ACCOUNT`: `terraform output -raw forecast_runtime_service_account_email`
- `MARKET_DATA_PROVIDER`: `jquants`
- `MARKET_DATA_CACHE_BACKEND`: `gcs`
- `MARKET_DATA_CACHE_GCS_BUCKET`: `terraform output -raw cache_bucket_name`
- `MARKET_DATA_CACHE_GCS_PREFIX`: `market-data-cache`
- `FORECAST_PREVIEW_ENABLED`: `true` after the forecast service is deployed

Optional variables:

- `WEB_MIN_INSTANCES`: defaults to `0`
- `WEB_MAX_INSTANCES`: defaults to `1`
- `WEB_MEMORY`: defaults to `512Mi`
- `WEB_CPU`: defaults to `1`
- `FORECAST_MIN_INSTANCES`: defaults to `0`
- `FORECAST_MAX_INSTANCES`: defaults to `1`
- `FORECAST_MEMORY`: defaults to `2Gi`; use `4Gi` for initial staging TimesFM tests
- `FORECAST_CPU`: defaults to `1`

For public hosting, do not set `JQUANTS_API_KEY` on Cloud Run. Users should provide their own J-Quants API key in the web UI.

## Drawdown Forecasting Preview

`時系列予測(preview)` is an optional daily-only feature backed by a separate private Cloud Run service. The web service keeps its lightweight runtime and calls the forecast service only when the user enables the preview and presses update.

- Web service: keeps the existing `512Mi` runtime.
- Forecast service: uses a separate Artifact Registry repository and a `2Gi` Cloud Run service because TimesFM inference is materially heavier.
- Daily raw history is fetched independently of the visible chart period:
  - J-Quants free tier: 2 years ending at the latest available free-tier date.
  - J-Quants paid tier and yfinance: 5 years.
- The forecast service is private. The web runtime service account invokes it with Cloud Run service-to-service authentication.

Terraform outputs the private service URL:

```powershell
terraform output -raw forecast_service_url
```

Forecast minimum instances default to `0`. If cold starts become unacceptable, raise `forecast_min_instances` in `infra/gcp/terraform.tfvars` and re-apply Terraform.

### Release flow

Staging deploys from `stg-v*` tags and may point to any branch or commit.

```powershell
git checkout feat/timesfm
git tag stg-v0.2.0-rc.1
git push origin stg-v0.2.0-rc.1
```

Production deploys from `v*` tags only when the tag commit is included in `origin/main`.

```powershell
git checkout main
git pull origin main
git tag v0.2.0
git push origin v0.2.0
```

The workflow verifies that production tag commits are included in `origin/main` before deploying.

### Custom domain with an external DNS provider

Cloud Run の公開 URL を独自ドメインへ切り替える場合は、任意のレジストラや DNS サービスで取得したドメインを使えます。以下は、お名前.com のような外部 DNS サービスを使う場合の手順です。

1. Google Search Console で対象ドメインの所有権確認を開始する。
   - 取得した TXT verification record を DNS サービスへ追加する。
   - DNS レコード編集画面で追加した TXT が外部から見えない場合は、ドメインがその DNS サービスのネームサーバーを実際に使っているか確認する。
2. 所有権確認が完了したら、Cloud Run に domain mapping を作成する。

   ```powershell
   gcloud beta run domain-mappings create `
     --service <cloud-run-service> `
     --domain <your-domain> `
     --region <region> `
     --project <project-id>
   ```

3. Cloud Run が返した `A` / `AAAA` / `CNAME` レコードを、DNS サービスの対象ドメインへ追加する。
   - レコード値はドメインごとにコマンド出力を確認して登録する。
   - Google の確認用 TXT は残してよい。
4. Google OAuth Client ID の `Authorized JavaScript origins` に、独自ドメインの origin を追加する。

   ```text
   https://<your-domain>
   ```

5. DNS 反映と Google 管理証明書の発行を待ち、HTTPS と Google ログインを確認する。

独自ドメイン切り替え後は、外部へ案内する URL、広告サービスへ登録するメディア URL、README や SNS で共有する URL を独自ドメインへそろえる運用を推奨します。

## Specs

機能要件、設計方針、実施順、実装実績は [`spec/README.md`](spec/README.md) で管理します。
