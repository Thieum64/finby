# Cloud Run Service Module
variable "name" {
  description = "Service name"
  type        = string
}

variable "location" {
  description = "GCP region"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "image" {
  description = "Container image URL"
  type        = string
  default     = null
}

variable "runtime_service_account" {
  description = "Service account email for the service"
  type        = string
  default     = null
}

variable "env_vars" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "cpu" {
  description = "CPU allocation"
  type        = string
  default     = null
}

variable "memory" {
  description = "Memory allocation"
  type        = string
  default     = null
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = null
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = null
}

variable "container_concurrency" {
  description = "Maximum number of concurrent requests per instance"
  type        = number
  default     = null
}

variable "port" {
  description = "Container port"
  type        = number
  default     = null
}

variable "ingress" {
  description = "Ingress setting"
  type        = string
  default     = null
}

variable "execution_environment" {
  description = "Execution environment"
  type        = string
  default     = null
}

variable "enable_public_invoker" {
  description = "Enable public invoker access"
  type        = bool
  default     = null
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "service" {
  name     = var.name
  location = var.location
  project  = var.project_id

  ingress = var.ingress

  template {
    dynamic "scaling" {
      for_each = (var.min_instances != null || var.max_instances != null) ? [1] : []
      content {
        min_instance_count = var.min_instances
        max_instance_count = var.max_instances
      }
    }

    service_account = var.runtime_service_account

    execution_environment = var.execution_environment
    max_instance_request_concurrency = var.container_concurrency

    containers {
      image = var.image

      dynamic "resources" {
        for_each = (var.cpu != null || var.memory != null) ? [1] : []
        content {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      ports {
        name = "http1"
        container_port = var.port != null ? var.port : 8080
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
        period_seconds    = 2
        timeout_seconds   = 2
        failure_threshold = 60
      }

      liveness_probe {
        http_get {
          path = "/healthz"
        }
        period_seconds    = 5
        timeout_seconds   = 2
        failure_threshold = 3
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# IAM binding for public access (conditional)
resource "google_cloud_run_service_iam_binding" "public_access" {
  count = var.enable_public_invoker == true ? 1 : 0

  location = google_cloud_run_v2_service.service.location
  project  = google_cloud_run_v2_service.service.project
  service  = google_cloud_run_v2_service.service.name

  role = "roles/run.invoker"
  members = [
    "allUsers",
  ]
}

# Outputs
output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.uri
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.name
}

output "service_id" {
  description = "ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.id
}