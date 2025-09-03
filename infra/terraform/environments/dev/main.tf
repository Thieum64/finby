# Dev Environment Infrastructure
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # TODO: M1 - Configure remote backend (GCS bucket)
  # backend "gcs" {
  #   bucket = "hyperush-dev-terraform-state"
  #   prefix = "dev"
  # }
}

# Variables
variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "hyperush-dev"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "runtime_service_account" {
  description = "Runtime service account email"
  type        = string
  default     = "runtime-sa@hyperush-dev.iam.gserviceaccount.com"
}

variable "artifact_registry_location" {
  description = "Artifact Registry location"
  type        = string
  default     = "europe-west1"
}

variable "registry_name" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "services"
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

# svc-authz Cloud Run Service
module "svc_authz" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-authz"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  # Default image (will be updated by CI/CD)
  image = "${var.artifact_registry_location}-docker.pkg.dev/${var.project_id}/${var.registry_name}/svc-authz:latest"
  
  # Resource allocation for dev environment
  cpu         = "1000m"
  memory      = "512Mi"
  min_instances = 0
  max_instances = 3

  # Allow public access for testing
  allow_public_access = true

  env_vars = {
    NODE_ENV          = "development"
    PORT              = "8080"
    LOG_LEVEL         = "info"
    GCP_PROJECT_ID    = var.project_id
    # TODO: M1 - Add OpenTelemetry configuration
    # OTEL_SERVICE_NAME    = "svc-authz"
    # OTEL_SERVICE_VERSION = "0.1.0"
  }
}

# Outputs
output "svc_authz_url" {
  description = "URL of the svc-authz service"
  value       = module.svc_authz.service_url
}

output "project_info" {
  description = "Project information"
  value = {
    project_id     = var.project_id
    project_number = data.google_project.project.number
    region         = var.region
  }
}

# TODO: M2 - Add additional services as they are implemented
# TODO: M2 - Add Firestore configuration
# TODO: M2 - Add Pub/Sub topics configuration
# TODO: M2 - Add Secret Manager secrets