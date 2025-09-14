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

# Container image variables for all services
variable "svc_authz_image" {
  description = "svc-authz container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:latest"
}

variable "svc_shops_image" {
  description = "svc-shops container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-shops:latest"
}

variable "svc_requests_image" {
  description = "svc-requests container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-requests:latest"
}

variable "svc_preview_image" {
  description = "svc-preview container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-preview:latest"
}

variable "svc_ia_diff_image" {
  description = "svc-ia-diff container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-ia-diff:latest"
}

variable "svc_quality_image" {
  description = "svc-quality container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-quality:latest"
}

variable "svc_billing_image" {
  description = "svc-billing container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-billing:latest"
}

variable "svc_notify_image" {
  description = "svc-notify container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-notify:latest"
}

variable "svc_admin_image" {
  description = "svc-admin container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/svc-admin:latest"
}

variable "api_gateway_image" {
  description = "api-gateway container image URI"
  type        = string
  default     = "europe-west1-docker.pkg.dev/hyperush-dev/services/api-gateway:latest"
}