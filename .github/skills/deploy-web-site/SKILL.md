---
name: deploy-web-site
description: Use when deploying this repository to staging or production on GCP Cloud Run via Terraform and GitHub Actions. Covers Terraform workspace and tfvars selection, importing existing GCP resources after 409 conflicts, GitHub Environment variables, release tagging, public-analysis job updates, and post-deploy verification.
---

# Deploy Web Site

Use this skill when releasing this repository to `staging` or `production`.

This repo deploys through:
- Terraform in [infra/gcp](../../infra/gcp)
- GitHub Actions workflow [deploy-cloud-run.yml](../../workflows/deploy-cloud-run.yml)
- Tag-driven releases
  - `stg-v*` -> staging
  - `v*` -> production

## Preflight

Before any deploy:

1. Make sure the target commit contains the latest [deploy-cloud-run.yml](../../workflows/deploy-cloud-run.yml).
2. For production, tag only commits already on `main`.
3. Do not run public-analysis jobs immediately after Terraform creates them. Terraform bootstraps those jobs with the `cloudrun/container/hello` image. The real app image is injected later by GitHub Actions in the `Update public analysis Cloud Run jobs` step.

## Terraform Workflow

Run Terraform from [infra/gcp](../../infra/gcp).

### Workspace

Keep staging and production in separate Terraform workspaces.

Common commands:

```powershell
terraform workspace list
terraform workspace show
terraform workspace select staging
terraform workspace select production
```

If the workspace does not exist:

```powershell
terraform workspace new staging
terraform workspace new production
```

### tfvars

`*.tfvars` files are manual inputs, not generated outputs.

If `production.tfvars` or `staging.tfvars` is missing, create it from [terraform.tfvars.example](../../infra/gcp/terraform.tfvars.example) or copy the other environment and edit it.

Minimum required values:

```hcl
project_id   = "..."
region       = "asia-northeast1"
environment  = "staging" # or "production"
github_owner = "..."
github_repo  = "stock-drawdown-chart-web"
```

### Plan / Apply

```powershell
terraform plan -var-file=".\staging.tfvars"
terraform apply -var-file=".\staging.tfvars"
```

```powershell
terraform plan -var-file=".\production.tfvars"
terraform apply -var-file=".\production.tfvars"
```

The `Note: You didn't use the -out option...` message is normal.

## Handling 409 Conflicts

If Terraform reports `already exists`, the resource exists in GCP but not in the current workspace state.

Use `terraform import`. Do not delete the resource.

Common import candidates in this repo:

- `google_artifact_registry_repository.docker`
- `google_artifact_registry_repository.forecast_docker`
- `google_storage_bucket.market_data_cache`
- `google_service_account.deploy`
- `google_service_account.cloud_build`
- `google_service_account.runtime`
- `google_service_account.forecast_runtime`
- `google_cloud_run_v2_service.forecast`
- `google_iam_workload_identity_pool.github`
- `google_iam_workload_identity_pool_provider.github`

Example patterns:

```powershell
terraform import -var-file=".\staging.tfvars" google_artifact_registry_repository.docker "projects/<project>/locations/<region>/repositories/<repo>"
terraform import -var-file=".\staging.tfvars" google_storage_bucket.market_data_cache "<bucket-name>"
terraform import -var-file=".\staging.tfvars" google_service_account.runtime "projects/<project>/serviceAccounts/<sa>@<project>.iam.gserviceaccount.com"
terraform import -var-file=".\staging.tfvars" google_cloud_run_v2_service.forecast "projects/<project>/locations/<region>/services/<service>"
```

### Workload Identity Pool / Provider Special Case

If create returns `409` but `describe` or `import` says not found, the resource may be `DELETED`, not `ACTIVE`.

Check with:

```powershell
gcloud iam workload-identity-pools list --project <project> --location global --show-deleted
gcloud iam workload-identity-pools providers list --project <project> --location global --workload-identity-pool <pool-id> --show-deleted
```

If state is `DELETED`, undelete first:

```powershell
gcloud iam workload-identity-pools undelete <pool-id> --project <project> --location global
gcloud iam workload-identity-pools providers undelete <provider-id> --project <project> --location global --workload-identity-pool <pool-id>
```

Then import them into Terraform state.

## GitHub Environment Variables

Verify the target GitHub Environment has the variables used by [deploy-cloud-run.yml](../../workflows/deploy-cloud-run.yml).

### Required for this repo

- `CLOUD_BUILD_SERVICE_ACCOUNT`
- `FORECAST_ARTIFACT_REPOSITORY`
- `FORECAST_RUNTIME_SERVICE_ACCOUNT`
- `FORECAST_SERVICE`
- `MARKET_DATA_CACHE_BACKEND`
- `MARKET_DATA_CACHE_GCS_BUCKET`
- `MARKET_DATA_CACHE_GCS_PREFIX`
- `MARKET_DATA_PROVIDER`
- `PUBLIC_ANALYSIS_BUCKET`
- `PUBLIC_ANALYSIS_PUBLISH_JOB`
- `PUBLIC_ANALYSIS_REFRESH_JOB`
- `REGION`
- `WEB_ARTIFACT_REPOSITORY`
- `WEB_RUNTIME_SERVICE_ACCOUNT`
- `WEB_SERVICE`

### Strongly recommended

- `FORECAST_CPU`
- `FORECAST_MAX_INSTANCES`
- `FORECAST_MEMORY`
- `FORECAST_MIN_INSTANCES`
- `FORECAST_PREVIEW_ENABLED`
- `PUBLIC_ANALYSIS_LOOKBACK_YEARS`
- `PUBLIC_ANALYSIS_PREFIX`
- `PUBLIC_ANALYSIS_PROVIDER`
- `WEB_CPU`
- `WEB_MAX_INSTANCES`
- `WEB_MEMORY`
- `WEB_MIN_INSTANCES`

## Tagging and Deploy

### Staging

```powershell
git checkout main
git pull origin main
git tag -a stg-vX.Y.Z -m "Staging deploy stg-vX.Y.Z"
git push origin stg-vX.Y.Z
```

### Production

```powershell
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "Production deploy vX.Y.Z"
git push origin vX.Y.Z
```

## What to Check in GitHub Actions

In `deploy-web`, confirm these steps exist and succeed:

- `Deploy web service`
- `Update public analysis Cloud Run jobs`

If `Update public analysis Cloud Run jobs` is missing entirely, the tag points to an older commit whose workflow file does not contain that step.

If the step exists but the Cloud Run job still uses the bootstrap image, inspect the step logs and verify:

- `PUBLIC_ANALYSIS_REFRESH_JOB`
- `PUBLIC_ANALYSIS_PUBLISH_JOB`

match the Terraform-created job names.

## Post-Deploy Verification

### 1. Confirm public-analysis jobs use the real app image

```powershell
gcloud run jobs describe <refresh-job> --project <project> --region <region> --format=json
gcloud run jobs describe <publish-job> --project <project> --region <region> --format=json
```

The job container image must not be `us-docker.pkg.dev/cloudrun/container/hello`.

### 2. Run refresh manually

```powershell
gcloud run jobs execute <refresh-job> --project <project> --region <region> --wait
```

Expected behavior:

- single-symbol Yahoo failures can be skipped
- refresh should still succeed while failure count stays below the configured threshold

This repo currently allows individual public-analysis symbol failures and fails the job only when the failure count reaches the configured threshold.

### 3. Run publish manually

```powershell
gcloud run jobs execute <publish-job> --project <project> --region <region> --wait
```

If publish fails with `No staged snapshot found for publish target`, refresh likely did not complete successfully, or the environment is still running older code.

### 4. Verify API and top page

Check:

- `/api/public-analysis` returns `snapshot != null`
- top page shows the public ranking
- stale message is reasonable

## Public Analysis Repo-Specific Notes

- Public-analysis staged snapshots are keyed by the refresh run date in JST.
- `refresh-public-analysis` and `publish-public-analysis` both run from the web app image.
- The top page ranking depends on precomputed snapshot data only. It does not recompute 100 symbols on request.

## Troubleshooting Quick Map

- `production.tfvars does not exist`
  - create the file manually from `terraform.tfvars.example`

- Terraform asks `Do you want to perform these actions in workspace "staging"?`
  - switch to the correct workspace before plan/apply

- Terraform `409 already exists`
  - import the resource into the current workspace state

- Workload Identity `409` but import says resource not found
  - check `--show-deleted`, undelete, then import

- Public-analysis job uses `hello` image
  - GitHub Actions has not yet updated the job, or the tag points to a workflow commit without the update step

- Publish fails with `No staged snapshot found`
  - refresh did not produce a staged snapshot for that run date, or the job image is old
