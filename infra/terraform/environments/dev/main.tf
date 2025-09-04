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
  
  # Image from CI/CD variable
  image = var.svc_authz_image
  
  # Resource allocation for dev environment
  cpu         = "1000m"
  memory      = "512Mi"
  min_instances = 0
  max_instances = 3

  # Allow public access for testing
  allow_public_access = true

  env_vars = {
    NODE_ENV          = "development"
    LOG_LEVEL         = "info"
    GCP_PROJECT_ID    = var.project_id
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