output "artifact_repository" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "environment" {
  description = "Deployment environment for this Terraform state."
  value       = local.environment
}

output "forecast_artifact_repository" {
  description = "Artifact Registry repository ID for forecast images."
  value       = google_artifact_registry_repository.forecast_docker.repository_id
}

output "cache_bucket_name" {
  description = "Cloud Storage bucket name for market data cache."
  value       = google_storage_bucket.market_data_cache.name
}

output "public_analysis_bucket_name" {
  description = "Cloud Storage bucket name for published public analysis snapshots."
  value       = google_storage_bucket.public_analysis.name
}

output "deploy_service_account_email" {
  description = "GitHub Actions deploy service account email. Use as GCP_SERVICE_ACCOUNT."
  value       = google_service_account.deploy.email
}

output "cloud_build_service_account_email" {
  description = "Cloud Build service account email. Use as CLOUD_BUILD_SERVICE_ACCOUNT."
  value       = google_service_account.cloud_build.email
}

output "runtime_service_account_email" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.runtime.email
}

output "scheduler_service_account_email" {
  description = "Cloud Scheduler service account email for public analysis jobs."
  value       = google_service_account.scheduler.email
}

output "forecast_runtime_service_account_email" {
  description = "Forecast Cloud Run runtime service account email."
  value       = google_service_account.forecast_runtime.email
}

output "forecast_service_url" {
  description = "Private forecast Cloud Run service URL."
  value       = google_cloud_run_v2_service.forecast.uri
}

output "forecast_service_name" {
  description = "Forecast Cloud Run service name."
  value       = google_cloud_run_v2_service.forecast.name
}

output "web_service_name" {
  description = "Recommended web Cloud Run service name for GitHub Environment variables."
  value       = "stock-drawdown-chart-web${local.environment_suffix}"
}

output "public_analysis_refresh_job_name" {
  description = "Cloud Run job name for staging public analysis snapshots."
  value       = google_cloud_run_v2_job.public_analysis_refresh.name
}

output "public_analysis_publish_job_name" {
  description = "Cloud Run job name for publishing public analysis snapshots."
  value       = google_cloud_run_v2_job.public_analysis_publish.name
}

output "workload_identity_provider" {
  description = "Workload Identity Provider resource name. Use as GCP_WORKLOAD_IDENTITY_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_repository" {
  description = "GitHub repository allowed to impersonate the deploy service account."
  value       = "${var.github_owner}/${var.github_repo}"
}
