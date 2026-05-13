# Google Cloud IaC

This directory provisions the Google Cloud resources required for tag-based Cloud Run deployment from GitHub Actions.

## What Terraform Creates

- Required Google Cloud APIs
- Artifact Registry Docker repository
- Cloud Storage bucket for market data cache
- 1-day cache object lifecycle rule
- GitHub Actions deploy service account
- Cloud Run runtime service account
- Workload Identity Pool and Provider for GitHub Actions OIDC
- IAM bindings for deployment and runtime cache access
- IAM bindings for the Cloud Build default service account to read submitted source archives, write build logs, and push images
- IAM binding that lets the GitHub Actions deploy service account act as the Cloud Build default service account

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

Copy the example variables file and edit the values.

```powershell
Copy-Item infra/gcp/terraform.tfvars.example infra/gcp/terraform.tfvars
```

Required values:

- `project_id`
- `github_owner`
- `github_repo`

`cache_bucket_name` is optional. If omitted, Terraform uses `<project_id>-stock-drawdown-cache`.

## Apply

```powershell
cd infra/gcp
terraform init
terraform plan
terraform apply
terraform output
```

If GitHub Actions fails during `gcloud builds submit` with a message like
`PROJECT_NUMBER-compute@developer.gserviceaccount.com does not have storage.objects.get access`,
pull the latest IaC changes and run `terraform apply` again. The Terraform
configuration grants the Cloud Build default service account the required
Storage, logging, and Artifact Registry permissions.

If it fails with `caller does not have permission to act as service account`,
run `terraform apply` again from the latest IaC. The deploy service account needs
`roles/iam.serviceAccountUser` on the Cloud Build default service account.

The GitHub Actions workflow uses `gcloud builds submit --suppress-logs` because
Cloud Build log streaming can require broader project viewer permissions. Open
the Cloud Build URL printed by the workflow when detailed build logs are needed.

## GitHub Settings After Apply

Add these repository secrets:

- `GCP_PROJECT_ID`: your Google Cloud project ID
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `terraform output -raw workload_identity_provider`
- `GCP_SERVICE_ACCOUNT`: `terraform output -raw deploy_service_account_email`
- `GOOGLE_CLIENT_ID`: Google OAuth client ID for the web app
- `ALLOWED_EMAIL`: the only Google account allowed to use the app

Add these repository variables:

- `MARKET_DATA_PROVIDER`: `jquants`
- `MARKET_DATA_CACHE_BACKEND`: `gcs`
- `MARKET_DATA_CACHE_GCS_BUCKET`: `terraform output -raw cache_bucket_name`
- `MARKET_DATA_CACHE_GCS_PREFIX`: `market-data-cache`

Do not set `JQUANTS_API_KEY` on public Cloud Run hosting. Users should enter their own key in the web UI.

## Release

After merging deployment changes to `main`, push a `v*` tag from a commit included in `main`.

```powershell
git checkout main
git pull origin main
git tag v0.1.0
git push origin v0.1.0
```
