# Dev Environment Infrastructure
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "hyperush-dev-tfstate"
    prefix = "terraform/dev"
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Data sources
data "google_project" "project" {
  project_id = var.project_id
}

# Firestore Database
resource "google_firestore_database" "database" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "PESSIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = "DELETE_PROTECTION_DISABLED"
  
  lifecycle {
    prevent_destroy = true
  }
}

# Infrastructure modules
module "pubsub" {
  source = "../../modules/pubsub"

  project_id  = var.project_id
  environment = "dev"
}

module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = "dev"
}

module "logging" {
  source = "../../modules/logging"

  project_id  = var.project_id
  environment = "dev"
}

# All Cloud Run Services
module "svc_authz" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-authz"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_authz_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_shops" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-shops"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_shops_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_requests" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-requests"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_requests_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_preview" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-preview"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_preview_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_ia_diff" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-ia-diff"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_ia_diff_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_quality" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-quality"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_quality_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_billing" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-billing"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_billing_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_notify" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-notify"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_notify_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "svc_admin" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-admin"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.svc_admin_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

module "api_gateway" {
  source = "../../modules/cloud_run_service"

  name                  = "api-gateway"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.api_gateway_image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = {
    NODE_ENV       = "development"
    LOG_LEVEL      = "info"
    GCP_PROJECT_ID = var.project_id
  }
}

# Service URLs
output "service_urls" {
  description = "URLs of all deployed services"
  value = {
    svc_authz    = module.svc_authz.service_url
    svc_shops    = module.svc_shops.service_url
    svc_requests = module.svc_requests.service_url
    svc_preview  = module.svc_preview.service_url
    svc_ia_diff  = module.svc_ia_diff.service_url
    svc_quality  = module.svc_quality.service_url
    svc_billing  = module.svc_billing.service_url
    svc_notify   = module.svc_notify.service_url
    svc_admin    = module.svc_admin.service_url
    api_gateway  = module.api_gateway.service_url
  }
}

# Infrastructure outputs
output "pubsub_topics" {
  description = "Created Pub/Sub topics"
  value       = module.pubsub.topics
}

output "pubsub_subscriptions" {
  description = "Created Pub/Sub subscriptions"
  value       = module.pubsub.subscriptions
}

output "secrets" {
  description = "Created secrets"
  value       = module.secrets.secrets
}

output "logging_metrics" {
  description = "Created log-based metrics"
  value       = module.logging.metrics
}

output "project_info" {
  description = "Project information"
  value = {
    project_id     = var.project_id
    project_number = data.google_project.project.number
    region         = var.region
  }
}