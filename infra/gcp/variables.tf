variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Artifact Registry."
  type        = string
  default     = "asia-northeast1"
}

variable "github_owner" {
  description = "GitHub repository owner or organization."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
}

variable "artifact_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "stock-drawdown"
}

variable "cache_bucket_name" {
  description = "Cloud Storage bucket name for market data cache. Defaults to <project_id>-stock-drawdown-cache."
  type        = string
  default     = null
}

variable "cache_bucket_location" {
  description = "Cloud Storage bucket location."
  type        = string
  default     = "ASIA-NORTHEAST1"
}

variable "cache_lifecycle_age_days" {
  description = "Delete cache objects older than this many days."
  type        = number
  default     = 1
}

variable "workload_identity_pool_id" {
  description = "Workload Identity Pool ID for GitHub Actions."
  type        = string
  default     = "github-actions-pool"
}

variable "workload_identity_provider_id" {
  description = "Workload Identity Provider ID for GitHub Actions."
  type        = string
  default     = "github-actions-provider"
}

variable "deploy_service_account_id" {
  description = "Service account ID used by GitHub Actions deployments."
  type        = string
  default     = "github-actions-deploy"
}

variable "runtime_service_account_id" {
  description = "Service account ID used by the Cloud Run runtime."
  type        = string
  default     = "stock-drawdown-runtime"
}
