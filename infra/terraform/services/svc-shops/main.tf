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
    prefix = "terraform/services/svc-shops"
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Cloud Run Service
module "service" {
  source = "../../modules/cloud_run_service"

  name                  = "svc-shops"
  location              = var.region
  project_id            = var.project_id
  service_account_email = var.runtime_service_account
  
  image = var.image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  allow_public_access = true

  env_vars = merge(
    {
      NODE_ENV       = "development"
      LOG_LEVEL      = "info"
      GCP_PROJECT_ID = var.project_id
    },
    var.env_vars
  )
}