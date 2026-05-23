# Drawdown Forecasting Design

## Application Flow

- The browser continues to call `POST /api/drawdowns`.
- The request adds `forecast_preview: bool`.
- The existing FastAPI service computes drawdown history and, when forecasting is enabled, sends daily drawdown-depth series to a private forecast Cloud Run service.
- The response adds `forecast` to each symbol result without changing the existing chart payload.

## Data Policy

- Daily raw data is fetched and cached at a provider-specific fixed horizon:
  - J-Quants free tier: 24 months.
  - J-Quants paid tier: 60 months.
  - yfinance: 60 months.
- The selected visible period is sliced from the cached raw history after fetch.
- Forecasting uses the fixed-horizon daily series before candle aggregation.
- At least 252 daily observations are required for inference.

## Forecast Interface

- The web backend sends:
  - `latest_data_date`
  - `drawdown_depths`
  - `horizon_business_days = 14`
- The forecast service returns:
  - `status`
  - `latest_data_date`
  - `points: [{ date, mean, lower, upper }]`
  - optional `message`
- Forecast output is converted back to negative drawdown values before returning to the browser.

## Frontend

- `時系列予測(preview)` is rendered alongside the existing technical settings.
- It is controlled separately from SMA/EMA/BBands and has no period field.
- The option is available only when `/api/config.forecast_preview_enabled` is true and the candle interval is daily.
- Individual cards render a forecast line, interval band, and short disclaimer.

## Infrastructure

- Add a separate forecast Artifact Registry repository.
- Add a private forecast Cloud Run service with its own runtime service account.
- Grant the web runtime service account `roles/run.invoker` on the forecast service.
- Keep forecast minimum instances configurable and default it to `0`.
- Use the existing release workflow, but split web and forecast deployment into separate jobs that must both succeed.

