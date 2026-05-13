locals {
  cache_bucket_name = coalesce(var.cache_bucket_name, "${var.project_id}-stock-drawdown-cache")
  github_repository = "${var.github_owner}/${var.github_repo}"

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
  ])

  deploy_project_roles = toset([
    "roles/artifactregistry.admin",
    "roles/cloudbuild.builds.editor",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageViewer",
    "roles/storage.admin",
  ])

  cloud_build_default_service_account = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  cloud_build_project_roles = toset([
    "roles/artifactregistry.writer",
    "roles/logging.logWriter",
    "roles/storage.objectViewer",
  ])
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "Drawdown Chart Cloud Run images"
  format        = "DOCKER"

  depends_on = [
    google_project_service.required["artifactregistry.googleapis.com"],
  ]
}

resource "google_storage_bucket" "market_data_cache" {
  project                     = var.project_id
  name                        = local.cache_bucket_name
  location                    = var.cache_bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age = var.cache_lifecycle_age_days
    }
  }

  depends_on = [
    google_project_service.required["storage.googleapis.com"],
  ]
}

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = var.deploy_service_account_id
  display_name = "GitHub Actions Cloud Run deploy"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_service_account_id
  display_name = "Stock Drawdown Cloud Run runtime"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_project_iam_member" "deploy_project_roles" {
  for_each = local.deploy_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "cloud_build_project_roles" {
  for_each = local.cloud_build_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${local.cloud_build_default_service_account}"
}

resource "google_service_account_iam_member" "deploy_can_use_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_storage_bucket_iam_member" "runtime_cache_object_admin" {
  bucket = google_storage_bucket.market_data_cache.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = var.workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC pool for GitHub Actions deployments."

  depends_on = [
    google_project_service.required["iamcredentials.googleapis.com"],
    google_project_service.required["sts.googleapis.com"],
  ]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_provider_id
  display_name                       = "GitHub Actions provider"
  description                        = "Trust tokens from the configured GitHub repository."

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${local.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_actions_can_impersonate_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${local.github_repository}"
}
