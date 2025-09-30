terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
  }
}

resource "google_cloud_run_v2_service" "this" {
  name     = var.name
  location = var.region
  ingress  = var.ingress

  template {
    service_account = var.service_account_email
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
    containers {
      image = var.image

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }
    }
  }
}