# Drawdown Forecasting Verification

## Status

- 判定: pass
- 検証日: 2026-05-18
- 検証者: Codex

## Requirements Checked

- Feature flag controls preview visibility.
- Forecast requests stay opt-in and daily-only.
- Fixed history fetch windows are 2 years for J-Quants free tier and 5 years otherwise.
- Insufficient history returns a non-fatal forecast status.
- Forecast service is isolated from the lightweight web service in both code and IaC.

## Commands

- `uv run pytest`
- `uv run python -m py_compile stock_drawdown_app.py forecast_service.py`
- `node --check static/app.js`
- `terraform -chdir=infra/gcp validate`
- Local browser check on `http://127.0.0.1:8010/`

## Findings

- No blocking findings after implementation.
- Existing test expectations were updated from visible-period fetching to fixed-horizon fetching.

## Remaining Issues

- Record deployed forecast Cloud Run cold-start and warm latency after the first production deployment.
