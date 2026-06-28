# Google Cloud IaC

This directory provisions the Google Cloud resources required for tag-based Cloud Run deployment from GitHub Actions.

The recommended setup uses separate Google Cloud projects for `staging` and `production`. Apply this Terraform module once per project with a separate `terraform.tfvars` and separate Terraform state.

## What Terraform Creates

- Required Google Cloud APIs
- Artifact Registry Docker repository
- Separate Artifact Registry Docker repository for forecast images
- Cloud Storage bucket for market data cache
- 1-day cache object lifecycle rule
- GitHub Actions deploy service account
- Cloud Build build service account
- Cloud Run runtime service account
- Forecast Cloud Run runtime service account
- Private forecast Cloud Run service for TimesFM inference
- Workload Identity Pool and Provider for GitHub Actions OIDC
- IAM bindings for deployment and runtime cache access
- IAM binding that lets the web runtime service account invoke the private forecast service
- IAM bindings for the Cloud Build service account to read submitted source archives, write build logs, and push images
- IAM binding that lets the GitHub Actions deploy service account act as the Cloud Build service account

## Prerequisites

1. Install Terraform.
2. Install the Google Cloud CLI.
3. Create or select a Google Cloud project.
4. Authenticate Terraform locally:

```powershell
gcloud auth application-default login
gcloud config set project <project-id>
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com
```

## Configure

Create separate variable files for staging and production. Do not switch staging and production values in the same Terraform workspace.

```powershell
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/staging.tfvars
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/production.tfvars
```

Required values:

- `project_id`
- `github_owner`
- `github_repo`
- `environment`: `staging` or `production`

`cache_bucket_name` is optional. If omitted, Terraform uses an environment-aware default:

- production: `<project_id>-stock-drawdown-cache`
- staging: `<project_id>-stock-drawdown-cache-staging`

Production keeps the historical unsuffixed names where they already fit Google Cloud naming limits. Staging appends `-staging` to standard service accounts, Artifact Registry repositories, and Cloud Run service names. The forecast runtime service account uses the shorter default `stock-dd-forecast-rt` / `stock-dd-forecast-rt-staging` so it stays within Google Cloud's service account ID length limit.

The Workload Identity Provider is also environment-scoped:

- staging trusts GitHub OIDC tokens from `refs/tags/stg-v*`
- production trusts GitHub OIDC tokens from `refs/tags/v*`

Example `staging.tfvars`:

```hcl
project_id   = "stage-web-stock-drawdown"
github_owner = "ykknd"
github_repo  = "stock-drawdown-chart-web"
environment  = "staging"
```

Example `production.tfvars`:

```hcl
project_id   = "<production-project-id>"
github_owner = "ykknd"
github_repo  = "stock-drawdown-chart-web"
environment  = "production"
```

## Apply

Use a separate Terraform workspace for each environment so Terraform state cannot confuse staging resources with production resources.

Staging:

```powershell
cd infra/gcp
terraform init
terraform workspace new staging
terraform workspace select staging
terraform plan -var-file="staging.tfvars"
terraform apply -var-file="staging.tfvars"
terraform output
```

Production:

```powershell
cd infra/gcp
terraform init
terraform workspace new production
terraform workspace select production
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
terraform output
```

If the workspace already exists, `terraform workspace new <name>` will fail. In that case, run only `terraform workspace select <name>`.

If Terraform fails because `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
does not exist, pull the latest IaC and re-run `terraform apply`. This module
uses its own Cloud Build service account instead of relying on Google Cloud's
project-dependent default Cloud Build service account.

If GitHub Actions fails during `gcloud builds submit` with a message about
`caller does not have permission to act as service account`, confirm that the
GitHub Environment variable `CLOUD_BUILD_SERVICE_ACCOUNT` is set to
`terraform output -raw cloud_build_service_account_email` and re-run
`terraform apply`.

The GitHub Actions workflow uses `gcloud builds submit --async` and polls the
build status with `gcloud builds describe` because Cloud Build log streaming can
require broader project viewer permissions. Open the Cloud Build URL printed by
the workflow when detailed build logs are needed.

## GitHub Settings After Apply

Create two GitHub Environments:

- `staging`
- `production`

Add the following secrets and variables to each environment, not as shared repository-wide deployment settings. Production should additionally use GitHub Environment protection rules such as required reviewers.

Environment secrets:

- `GCP_PROJECT_ID`: your Google Cloud project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `terraform output -raw workload_identity_provider`
- `GCP_SERVICE_ACCOUNT`: `terraform output -raw deploy_service_account_email`
- `GOOGLE_CLIENT_ID`: Google OAuth client ID for the web app

Optional environment secret:

- `ALLOWED_EMAIL`: set only where private single-email access is needed. Leave unset for public hosting where any verified Google account may use the app.

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
- `FORECAST_PREVIEW_ENABLED`: `true` after the forecast service is ready for use

Optional environment variables:

- `WEB_MIN_INSTANCES`: defaults to `0`
- `WEB_MAX_INSTANCES`: defaults to `1`
- `WEB_MEMORY`: defaults to `512Mi`
- `WEB_CPU`: defaults to `1`
- `FORECAST_MIN_INSTANCES`: defaults to `0`
- `FORECAST_MAX_INSTANCES`: defaults to `1`
- `FORECAST_MEMORY`: defaults to `2Gi` in the workflow. For initial staging TimesFM tests, set `4Gi`.
- `FORECAST_CPU`: defaults to `1`

Additional useful Terraform outputs:

- `forecast_artifact_repository`
- `forecast_runtime_service_account_email`
- `forecast_service_url`

The forecast service defaults to `min instances = 0`, `max instances = 1`, and `2Gi` memory. If cold starts become a product issue, set `forecast_min_instances = 1` in `terraform.tfvars` and re-apply Terraform.

Do not set `JQUANTS_API_KEY` on the public web Cloud Run service. Users should enter their own key in the web UI. If the public-analysis refresh job uses J-Quants listed securities to build its universe, set `JQUANTS_API_KEY` on that job only.

## Custom Domain

Custom domain setup is manual and is not provisioned by this Terraform module.

1. Verify ownership of the domain in Google Search Console by adding the issued TXT record at the external DNS provider.
2. Create the Cloud Run domain mapping after verification succeeds.
3. Add the DNS records returned by Cloud Run to the external DNS provider.
4. Add `https://<your-domain>` to the Google OAuth Client ID `Authorized JavaScript origins`.
5. Wait for DNS propagation and managed certificate provisioning, then verify HTTPS and Google login.

If the DNS provider has a separate DNS-record editor and nameserver setting, confirm that the domain is delegated to the same nameservers where the TXT and routing records were added.

## Tag-Based Deployments

Deployments are selected by tag name.

Staging tags can point to any branch or commit:

```powershell
git checkout feat/timesfm
git tag stg-v0.2.0-rc.1
git push origin stg-v0.2.0-rc.1
```

Production tags must point to a commit included in `origin/main`; the workflow verifies this before deploying:

```powershell
git checkout main
git pull origin main
git tag v0.2.0
git push origin v0.2.0
```

Tag rules:

- `stg-vX.Y.Z-rc.N`: deploys to the `staging` GitHub Environment and staging GCP project.
- `vX.Y.Z`: deploys to the `production` GitHub Environment and production GCP project.
