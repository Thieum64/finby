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
    prefix = "terraform/services/svc-notify"
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

  name                  = "svc-notify"
  location              = var.region
  project_id            = var.project_id
  runtime_service_account = var.runtime_service_account
  
  image = var.image
  
  cpu           = "1000m"
  memory        = "512Mi"
  min_instances = 0
  max_instances = 3

  # Optional variables for imports compatibility
  container_concurrency = var.container_concurrency
  port                  = var.port
  ingress               = var.ingress
  execution_environment = var.execution_environment

  enable_public_invoker = true

  # Temporarily disable startup probe to allow service to start
  enable_startup_probe = false

  env_vars = merge(
    {
      NODE_ENV       = "development"
      LOG_LEVEL      = "info"
      GCP_PROJECT_ID = var.project_id
      FIREBASE_PROJECT_ID  = var.project_id
      SERVICE_VERSION      = "1.0.0"
      ENABLE_OTEL          = "false"
    },
    var.env_vars
  )
}