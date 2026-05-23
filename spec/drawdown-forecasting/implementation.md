# Drawdown Forecasting Implementation

## Implemented

- Added fixed-horizon raw-data fetching, forecast request/response models, and an HTTP forecast client to the web API.
- Added a separate `forecast_service.py` entrypoint and `Dockerfile.forecast` for TimesFM inference.
- Added frontend preview controls, per-card forecast rendering, interval bands, and disclaimer messaging.
- Added forecast Cloud Run IaC resources and split release deployment into forecast and web jobs.
- Implementation was completed by Codex at the user's direct request rather than the usual Gemini handoff.

## Changed Files

- `.github/workflows/deploy-cloud-run.yml`
- `.github/workflows/test.yml`
- `cloudbuild.forecast.yaml`
- `Dockerfile.forecast`
- `forecast_service.py`
- `stock_drawdown_app.py`
- `static/app.js`
- `static/styles.css`
- `infra/gcp/*`
- `README.md`
- `GEMINI.md`
- `tests/test_drawdown.py`
- `tests/test_forecast_service.py`
- `tests/test_jquants.py`
- `tests/test_market_cache.py`

## Checks Reported

- `uv run pytest` -> 66 passed
- `uv run python -m py_compile stock_drawdown_app.py forecast_service.py` -> pass
- `node --check static/app.js` -> pass
- `terraform -chdir=infra/gcp validate` -> pass
- Manual browser check on local server -> preview option displayed; weekly interval showed the daily-only hint

## Unresolved Items

- Cold-start and warm-latency measurements for the deployed forecast Cloud Run service remain to be recorded after deployment.
