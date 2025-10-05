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

# Infrastructure modules
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

# Cloud Run Services
module "svc_authz" {
  source = "../../modules/cloud_run_service"

  name       = "svc-authz"
  location   = var.region
  project_id = var.project_id
  image      = var.svc_authz_image

  runtime_service_account = "svc-authz-sa@${var.project_id}.iam.gserviceaccount.com"

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