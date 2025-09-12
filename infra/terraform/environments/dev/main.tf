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
# Note: Database is managed outside Terraform as it already exists in production
# and contains important data. Manual management avoids accidental destruction.
data "google_project" "firestore_project" {
  project_id = var.project_id
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

output "project_info" {
  description = "Project information"
  value = {
    project_id     = var.project_id
    project_number = data.google_project.project.number
    region         = var.region
  }
}