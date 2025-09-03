# Cloud Run Job Module
variable "name" {
  description = "Job name"
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
}

variable "service_account_email" {
  description = "Service account email for the job"
  type        = string
}

variable "env_vars" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "cpu" {
  description = "CPU allocation"
  type        = string
  default     = "1000m"
}

variable "memory" {
  description = "Memory allocation"
  type        = string
  default     = "1Gi"
}

variable "task_count" {
  description = "Number of tasks to run in parallel"
  type        = number
  default     = 1
}

variable "parallelism" {
  description = "Number of tasks to run simultaneously"
  type        = number
  default     = 1
}

variable "task_timeout" {
  description = "Task timeout in seconds"
  type        = number
  default     = 3600
}

# Cloud Run Job
resource "google_cloud_run_v2_job" "job" {
  name     = var.name
  location = var.location
  project  = var.project_id

  template {
    parallelism = var.parallelism
    task_count  = var.task_count
    
    template {
      timeout        = "${var.task_timeout}s"
      service_account = var.service_account_email

      containers {
        image = var.image

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }

        dynamic "env" {
          for_each = var.env_vars
          content {
            name  = env.key
            value = env.value
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image, # Managed by CI/CD
    ]
  }
}

# Outputs
output "job_name" {
  description = "Name of the Cloud Run job"
  value       = google_cloud_run_v2_job.job.name
}

output "job_id" {
  description = "ID of the Cloud Run job"
  value       = google_cloud_run_v2_job.job.id
}