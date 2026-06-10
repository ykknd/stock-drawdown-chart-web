variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Artifact Registry."
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "Deployment environment name. Use staging or production."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be either staging or production."
  }
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
  description = "Artifact Registry Docker repository ID. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "forecast_artifact_repository_id" {
  description = "Artifact Registry Docker repository ID for forecast images. Defaults to an environment-aware standard name."
  type        = string
  default     = null
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

variable "public_analysis_bucket_name" {
  description = "Cloud Storage bucket name for published public analysis snapshots. Defaults to <project_id>-stock-drawdown-public-analysis."
  type        = string
  default     = null
}

variable "public_analysis_bucket_location" {
  description = "Cloud Storage bucket location for public analysis snapshots."
  type        = string
  default     = "ASIA-NORTHEAST1"
}

variable "public_analysis_lifecycle_age_days" {
  description = "Delete staged public analysis objects older than this many days."
  type        = number
  default     = 30
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
  description = "Service account ID used by GitHub Actions deployments. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "cloud_build_service_account_id" {
  description = "Service account ID used by Cloud Build builds. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "runtime_service_account_id" {
  description = "Service account ID used by the Cloud Run runtime. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "scheduler_service_account_id" {
  description = "Service account ID used by Cloud Scheduler to trigger Cloud Run jobs."
  type        = string
  default     = null
}

variable "forecast_runtime_service_account_id" {
  description = "Service account ID used by the forecast Cloud Run runtime. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "forecast_service_name" {
  description = "Cloud Run service name for TimesFM inference. Defaults to an environment-aware standard name."
  type        = string
  default     = null
}

variable "web_bootstrap_image" {
  description = "Initial image used when Terraform creates the public analysis Cloud Run jobs."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "public_analysis_refresh_job_name" {
  description = "Cloud Run job name for staging public analysis snapshots."
  type        = string
  default     = null
}

variable "public_analysis_publish_job_name" {
  description = "Cloud Run job name for publishing public analysis snapshots."
  type        = string
  default     = null
}

variable "forecast_bootstrap_image" {
  description = "Initial image used when Terraform creates the private forecast Cloud Run service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "forecast_memory" {
  description = "Memory limit for the forecast Cloud Run service."
  type        = string
  default     = null
}

variable "forecast_cpu" {
  description = "CPU limit for the forecast Cloud Run service."
  type        = string
  default     = "1"
}

variable "forecast_min_instances" {
  description = "Minimum forecast service instances kept warm."
  type        = number
  default     = 0
}

variable "forecast_max_instances" {
  description = "Maximum forecast service instances."
  type        = number
  default     = 1
}
