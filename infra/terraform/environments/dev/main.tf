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

# Firestore Database - Not managed as Terraform resource
# Current production state: location_id=eur3, pitr=disabled
# Access via data source if needed by applications

# Use existing service accounts
data "google_service_account" "svc_authz_sa" {
  account_id = "svc-authz-sa"
  project    = var.project_id
}

data "google_service_account" "svc_api_gateway_sa" {
  account_id = "svc-api-gateway-sa"
  project    = var.project_id
}

module "pubsub" {
  source      = "../../modules/pubsub"
  project_id  = var.project_id
  environment = "dev"
}

module "secrets" {
  source      = "../../modules/secrets"
  project_id  = var.project_id
  environment = "dev"
}

module "logging" {
  source = "../../modules/logging"
  project_id        = var.project_id
  environment       = "dev"
  enable_metrics    = var.enable_metrics
  enable_error_sink = var.enable_error_sink
}

# TODO: Réintégrer le module monitoring complexe après correction des erreurs d'API
# module "monitoring" {
#   source      = "../../modules/monitoring"
#   project_id  = var.project_id
#   environment = "dev"
#
#   # Enable dashboards and alerts
#   enable_dashboards = var.enable_monitoring_dashboards
#   enable_alerts     = var.enable_monitoring_alerts
#
#   # Budget configuration
#   budget_amount     = var.monthly_budget_amount
#   budget_thresholds = var.budget_alert_thresholds
#
#   # Services to monitor
#   services = ["svc-authz", "svc-api-gateway", "worker-jobs"]
#
#   # Notification channels (empty for now, can be added later)
#   notification_channels = []
# }

# Use existing service account for worker
data "google_service_account" "worker_sa" {
  account_id = "svc-authz-sa"
  project    = var.project_id
}

# Worker Pub/Sub Job (squelette)
module "worker_jobs" {
  source = "../../modules/cloud_run_job"

  name                   = "worker-jobs"
  location              = var.region
  project_id            = var.project_id
  image                 = var.svc_authz_image
  service_account_email = data.google_service_account.worker_sa.email

  env_vars = {
    GCP_PROJECT_ID = var.project_id
    NODE_ENV       = "production"
    LOG_LEVEL      = "info"
    WORKER_TYPE    = "pubsub-jobs"
  }

  cpu         = "1000m"
  memory      = "1Gi"
  task_count  = 1
  parallelism = 1
  task_timeout = 300
}

# Cloud Run Services
module "svc_authz" {
  source = "../../modules/cloud_run_service"

  name       = "svc-authz"
  location   = var.region
  project_id = var.project_id
  image      = var.svc_authz_image

  runtime_service_account = data.google_service_account.svc_authz_sa.email

  env_vars = {
    GCP_PROJECT_ID = var.project_id
    NODE_ENV       = "production"
    LOG_LEVEL      = "info"
  }

  cpu                     = "1"
  memory                  = "1Gi"
  min_instances          = 0
  max_instances          = 10
  container_concurrency  = 80
  port                   = 8080
  ingress                = "INGRESS_TRAFFIC_ALL"
  execution_environment  = "EXECUTION_ENVIRONMENT_GEN2"
  enable_public_invoker  = true
}

# API Gateway Service
module "svc_api_gateway" {
  source = "../../modules/cloud_run_service"

  name       = "svc-api-gateway"
  location   = var.region
  project_id = var.project_id
  image      = var.svc_api_gateway_image

  runtime_service_account = data.google_service_account.svc_api_gateway_sa.email

  env_vars = {
    GCP_PROJECT_ID = var.project_id
    NODE_ENV       = "production"
    LOG_LEVEL      = "info"
    SVC_AUTHZ_URL  = module.svc_authz.service_url
  }

  cpu                     = "1"
  memory                  = "1Gi"
  min_instances          = 0
  max_instances          = 10
  container_concurrency  = 80
  port                   = 8080
  ingress                = "INGRESS_TRAFFIC_ALL"
  execution_environment  = "EXECUTION_ENVIRONMENT_GEN2"
  enable_public_invoker  = true
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

# Firestore outputs removed - not managed by Terraform

output "enabled_apis" {
  description = "List of enabled APIs"
  value       = module.logging.enabled_apis
}

output "project_info" {
  description = "Project information"
  value = {
    project_id     = var.project_id
    project_number = data.google_project.project.number
    region         = var.region
  }
}

output "svc_authz_url" {
  description = "URL of the svc-authz service"
  value       = module.svc_authz.service_url
}

output "svc_api_gateway_url" {
  description = "URL of the svc-api-gateway service"
  value       = module.svc_api_gateway.service_url
}

output "worker_jobs_name" {
  description = "Name of the worker jobs"
  value       = module.worker_jobs.job_name
}

# TODO: Réintégrer les outputs monitoring après correction du module
# # Monitoring outputs
# output "monitoring_dashboard_urls" {
#   description = "URLs of monitoring dashboards"
#   value       = module.monitoring.dashboard_urls
# }
#
# output "monitoring_alert_policies" {
#   description = "Created alert policy IDs"
#   value       = module.monitoring.alert_policy_ids
# }
#
# output "monitoring_console_url" {
#   description = "Google Cloud Monitoring console URL"
#   value       = module.monitoring.monitoring_console_url
# }
#
# output "budget_name" {
#   description = "Budget name for cost monitoring"
#   value       = module.monitoring.budget_name
# }