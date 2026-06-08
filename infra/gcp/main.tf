locals {
  environment        = lower(var.environment)
  environment_suffix = local.environment == "production" ? "" : "-${local.environment}"

  artifact_repository_id          = coalesce(var.artifact_repository_id, "stock-drawdown${local.environment_suffix}")
  forecast_artifact_repository_id = coalesce(var.forecast_artifact_repository_id, "stock-drawdown-forecast${local.environment_suffix}")
  cache_bucket_name               = coalesce(var.cache_bucket_name, "${var.project_id}-stock-drawdown-cache${local.environment_suffix}")
  public_analysis_bucket_name     = coalesce(var.public_analysis_bucket_name, "${var.project_id}-stock-drawdown-public-analysis${local.environment_suffix}")
  deploy_service_account_id       = coalesce(var.deploy_service_account_id, "github-actions-deploy${local.environment_suffix}")
  cloud_build_service_account_id  = coalesce(var.cloud_build_service_account_id, "stock-drawdown-build${local.environment_suffix}")
  runtime_service_account_id      = coalesce(var.runtime_service_account_id, "stock-drawdown-runtime${local.environment_suffix}")
  scheduler_service_account_id    = coalesce(var.scheduler_service_account_id, "stock-dd-scheduler${local.environment_suffix}")
  forecast_runtime_service_account_id = coalesce(
    var.forecast_runtime_service_account_id,
    "stock-dd-forecast-rt${local.environment_suffix}"
  )
  forecast_service_name        = coalesce(var.forecast_service_name, "stock-drawdown-forecast-api${local.environment_suffix}")
  public_analysis_refresh_job_name = coalesce(var.public_analysis_refresh_job_name, "stock-drawdown-public-analysis-refresh${local.environment_suffix}")
  public_analysis_publish_job_name = coalesce(var.public_analysis_publish_job_name, "stock-drawdown-public-analysis-publish${local.environment_suffix}")
  forecast_memory              = coalesce(var.forecast_memory, local.environment == "staging" ? "4Gi" : "2Gi")
  github_repository            = "${var.github_owner}/${var.github_repo}"
  workload_identity_ref_prefix = local.environment == "staging" ? "refs/tags/stg-v" : "refs/tags/v"

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
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
  repository_id = local.artifact_repository_id
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

resource "google_storage_bucket" "public_analysis" {
  project                     = var.project_id
  name                        = local.public_analysis_bucket_name
  location                    = var.public_analysis_bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age = var.public_analysis_lifecycle_age_days
      matches_prefix = [
        "public-analysis/staged/",
      ]
    }
  }

  depends_on = [
    google_project_service.required["storage.googleapis.com"],
  ]
}

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = local.deploy_service_account_id
  display_name = "GitHub Actions Cloud Run deploy"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "cloud_build" {
  project      = var.project_id
  account_id   = local.cloud_build_service_account_id
  display_name = "Stock Drawdown Cloud Build"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = local.runtime_service_account_id
  display_name = "Stock Drawdown Cloud Run runtime"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_service_account" "scheduler" {
  project      = var.project_id
  account_id   = local.scheduler_service_account_id
  display_name = "Stock Drawdown Cloud Scheduler"

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

resource "google_service_account" "forecast_runtime" {
  project      = var.project_id
  account_id   = local.forecast_runtime_service_account_id
  display_name = "Stock Drawdown forecast Cloud Run runtime"

  depends_on = [
    google_project_service.required["iam.googleapis.com"],
  ]
}

resource "google_artifact_registry_repository" "forecast_docker" {
  project       = var.project_id
  location      = var.region
  repository_id = local.forecast_artifact_repository_id
  description   = "Drawdown forecast Cloud Run images"
  format        = "DOCKER"

  depends_on = [
    google_project_service.required["artifactregistry.googleapis.com"],
  ]
}

resource "google_project_iam_member" "cloud_build_project_roles" {
  for_each = local.cloud_build_project_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_service_account_iam_member" "deploy_can_use_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_can_use_forecast_runtime" {
  service_account_id = google_service_account.forecast_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_can_use_cloud_build_default" {
  service_account_id = google_service_account.cloud_build.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_storage_bucket_iam_member" "runtime_cache_object_admin" {
  bucket = google_storage_bucket.market_data_cache.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_public_analysis_object_admin" {
  bucket = google_storage_bucket.public_analysis.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_job" "public_analysis_refresh" {
  project  = var.project_id
  location = var.region
  name     = local.public_analysis_refresh_job_name

  template {
    template {
      service_account = google_service_account.runtime.email

      containers {
        image   = var.web_bootstrap_image
        command = ["python"]
        args    = ["stock_drawdown_app.py", "refresh-public-analysis"]

        env {
          name  = "PUBLIC_ANALYSIS_BUCKET"
          value = google_storage_bucket.public_analysis.name
        }

        env {
          name  = "PUBLIC_ANALYSIS_PREFIX"
          value = "public-analysis"
        }

        env {
          name  = "PUBLIC_ANALYSIS_LOOKBACK_YEARS"
          value = "5"
        }

        env {
          name  = "PUBLIC_ANALYSIS_PROVIDER"
          value = "yfinance"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
  ]
}

resource "google_cloud_run_v2_job" "public_analysis_publish" {
  project  = var.project_id
  location = var.region
  name     = local.public_analysis_publish_job_name

  template {
    template {
      service_account = google_service_account.runtime.email

      containers {
        image   = var.web_bootstrap_image
        command = ["python"]
        args    = ["stock_drawdown_app.py", "publish-public-analysis"]

        env {
          name  = "PUBLIC_ANALYSIS_BUCKET"
          value = google_storage_bucket.public_analysis.name
        }

        env {
          name  = "PUBLIC_ANALYSIS_PREFIX"
          value = "public-analysis"
        }

        env {
          name  = "PUBLIC_ANALYSIS_LOOKBACK_YEARS"
          value = "5"
        }

        env {
          name  = "PUBLIC_ANALYSIS_PROVIDER"
          value = "yfinance"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
  ]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_can_run_public_analysis_refresh" {
  project  = google_cloud_run_v2_job.public_analysis_refresh.project
  location = google_cloud_run_v2_job.public_analysis_refresh.location
  name     = google_cloud_run_v2_job.public_analysis_refresh.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_can_run_public_analysis_publish" {
  project  = google_cloud_run_v2_job.public_analysis_publish.project
  location = google_cloud_run_v2_job.public_analysis_publish.location
  name     = google_cloud_run_v2_job.public_analysis_publish.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "public_analysis_refresh" {
  project   = var.project_id
  region    = var.region
  name      = "${local.public_analysis_refresh_job_name}-weekday-1800"
  schedule  = "0 18 * * 1-5"
  time_zone = "Asia/Tokyo"

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.public_analysis_refresh.name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}

resource "google_cloud_scheduler_job" "public_analysis_publish_2000" {
  project   = var.project_id
  region    = var.region
  name      = "${local.public_analysis_publish_job_name}-weekday-2000"
  schedule  = "0 20 * * 1-5"
  time_zone = "Asia/Tokyo"

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.public_analysis_publish.name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}

resource "google_cloud_scheduler_job" "public_analysis_publish_2400" {
  project   = var.project_id
  region    = var.region
  name      = "${local.public_analysis_publish_job_name}-weekday-2400"
  schedule  = "0 0 * * 2-6"
  time_zone = "Asia/Tokyo"

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.public_analysis_publish.name}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}

resource "google_cloud_run_v2_service" "forecast" {
  project             = var.project_id
  location            = var.region
  name                = local.forecast_service_name
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.forecast_runtime.email

    scaling {
      min_instance_count = var.forecast_min_instances
      max_instance_count = var.forecast_max_instances
    }

    containers {
      image = var.forecast_bootstrap_image

      resources {
        limits = {
          cpu    = var.forecast_cpu
          memory = local.forecast_memory
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
  ]
}

resource "google_cloud_run_v2_service_iam_member" "web_runtime_can_invoke_forecast" {
  project  = google_cloud_run_v2_service.forecast.project
  location = google_cloud_run_v2_service.forecast.location
  name     = google_cloud_run_v2_service.forecast.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.runtime.email}"
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

  attribute_condition = "assertion.repository == \"${local.github_repository}\" && assertion.ref.startsWith(\"${local.workload_identity_ref_prefix}\")"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_actions_can_impersonate_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${local.github_repository}"
}
