# Drawdown Forecasting Tasks

## Tasks

- [x] Add forecasting request/response models and config flags to the existing API.
- [x] Change raw market-data fetches to fixed provider-specific horizons and slice visible data after fetch.
- [x] Add forecast client integration to the web backend.
- [x] Add a standalone forecast service entrypoint and forecast container image.
- [x] Add `時系列予測(preview)` to the frontend and render forecast output in individual cards.
- [x] Add forecast-related styles, loading/error states, and disclaimer copy.
- [x] Extend Terraform with the forecast repository, service account, private Cloud Run service, and invoker IAM.
- [x] Extend the tag deployment workflow with separate web and forecast jobs.
- [x] Add tests for fixed horizon fetching, forecast response behavior, config flags, and forecast-service output.
- [x] Run backend, frontend syntax, and Terraform validation checks.
- [x] Record implementation details and verification results.

## Acceptance Checks

- [x] Preview is hidden when the feature flag is disabled.
- [x] Daily preview returns future points; non-daily preview is rejected or disabled.
- [x] Less than one year of data yields an insufficient-history forecast status.
- [x] Web and forecast Cloud Run resources are separate.
- [x] Release fails if either deploy job fails.
