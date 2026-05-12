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

Cloud Storageバケット側で、cache objectを1日で削除するライフサイクルルールを設定する運用を推奨します。このアプリはバケット作成やライフサイクル設定の自動作成は行いません。

J-Quantsのキャッシュはcredential scope単位で分離します。画面入力されたAPIキーはSHA-256 hashをscopeとして使い、APIキー生値はcache key、ファイル名、object名、cache本文、レスポンス、ログに保存しません。

### Required Google Cloud setup

- Cloud Run service: `stock-drawdown-chart-web`
- Region: `asia-northeast1`
- Artifact Registry repository: `stock-drawdown`
- Authentication from GitHub Actions: Workload Identity Federation
- Runtime access: Cloud Run allows unauthenticated requests, but the app requires Google login and allows only `ALLOWED_EMAIL`.

Grant the GitHub Actions deploy service account permissions for Cloud Run deploy, Artifact Registry, Cloud Build, and service account usage.

### Required GitHub secrets

Add these in `GitHub repository Settings -> Secrets and variables -> Actions -> Repository secrets`.

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GOOGLE_CLIENT_ID`
- `ALLOWED_EMAIL`

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
