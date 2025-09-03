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

variable "svc_authz_image" {
  description = "svc-authz container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:latest"
}