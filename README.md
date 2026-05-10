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
