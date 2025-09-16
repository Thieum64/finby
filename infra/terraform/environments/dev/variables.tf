# Dev Environment Variables

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

# Logging feature flags
variable "enable_metrics" {
  description = "Enable log-based metrics creation"
  type        = bool
  default     = false
}

variable "enable_error_sink" {
  description = "Enable error log sink to storage"
  type        = bool
  default     = false
}

