# Drawdown Forecasting Requirements

## User Value

- Users can preview the likely near-term path of drawdown depth from the latest available daily data.
- Forecasting remains opt-in so the normal chart workflow stays light.
- The existing web service stays small while heavier inference work is isolated.

## Requirements

- Add `時系列予測(preview)` as a technical option in the chart settings.
- Run forecasting only when the option is enabled and the user presses the update button.
- Support preview output only for daily candles in the first release.
- Forecast 14 future business days from the latest available data date.
- Use non-negative drawdown depth (`-drawdown`) as the model input and convert the output back to drawdown values for display.
- Show the forecast only in individual symbol cards, with a mean line and an 80% interval band.
- Display a short disclaimer near the forecast that it is a preview and not investment advice.
- Require at least one year of daily history before forecasting.
- Fetch daily raw history independently of the visible period:
  - J-Quants free tier: 2 years ending at the latest available free-tier date.
  - J-Quants paid tier: 5 years.
  - yfinance: 5 years.
- Keep the browser-facing API on the existing FastAPI service and call a separate private inference service from the backend.
- Hide the preview UI unless forecast preview is enabled by environment configuration.

## Out of Scope

- Model fine-tuning or custom training.
- Weekly or monthly forecast output.
- Portfolio-level forecasting.
- Automatic investment recommendations.
- Async job orchestration for the first release.

## Acceptance Criteria

- Preview is absent when the feature flag is disabled.
- Preview can be requested only for daily candles and is disabled for weekly/monthly candles in the UI.
- A successful response includes 14 future business-day forecast points per eligible symbol.
- Symbols with less than one year of history return a forecast status explaining that history is insufficient.
- The main Cloud Run service does not load TimesFM.
- The inference service is private and callable by the web runtime service account only.

