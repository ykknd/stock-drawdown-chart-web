output "artifact_repository" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "cache_bucket_name" {
  description = "Cloud Storage bucket name for market data cache."
  value       = google_storage_bucket.market_data_cache.name
}

output "deploy_service_account_email" {
  description = "GitHub Actions deploy service account email. Use as GCP_SERVICE_ACCOUNT."
  value       = google_service_account.deploy.email
}

output "runtime_service_account_email" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.runtime.email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider resource name. Use as GCP_WORKLOAD_IDENTITY_PROVIDER."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_repository" {
  description = "GitHub repository allowed to impersonate the deploy service account."
  value       = "${var.github_owner}/${var.github_repo}"
}
