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

# Firestore Database - Back under IaC with protection
# Current production state: location_id=eur3, pitr=disabled
resource "google_firestore_database" "database" {
  project                           = var.project_id
  name                              = "(default)"
  location_id                       = "eur3"  # Match existing production setting
  type                              = "FIRESTORE_NATIVE"
  concurrency_mode                  = "PESSIMISTIC"
  app_engine_integration_mode       = "DISABLED"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"  # Match existing
  delete_protection_state           = "DELETE_PROTECTION_DISABLED"
  
  lifecycle {
    prevent_destroy = true
    # Ignore changes to fields that may drift to avoid replacements
    ignore_changes = [
      location_id,
      concurrency_mode,
      app_engine_integration_mode,
      point_in_time_recovery_enablement,
      earliest_version_time,
      etag,
      uid,
      version_retention_period
    ]
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

# Cloud Run Services are managed by individual deployment jobs
# This ensures Docker images are built before services are deployed

# Service URLs (managed by individual deployment jobs)
# Each deployment job will handle its own service creation and URL output

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

output "firestore_info" {
  description = "Firestore database information"
  value = {
    name         = google_firestore_database.database.name
    location_id  = google_firestore_database.database.location_id
    type         = google_firestore_database.database.type
  }
}

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