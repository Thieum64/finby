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

variable "svc_authz_image" {
  description = "Docker image for svc-authz service"
  type        = string
  default     = ""
}

variable "svc_api_gateway_image" {
  description = "Docker image for svc-api-gateway service"
  type        = string
  default     = ""
}

variable "svc_shops_image" {
  description = "Docker image for svc-shops service"
  type        = string
  default     = ""
}

variable "worker_subscriber_image" {
  description = "Docker image for worker-subscriber service"
  type        = string
  default     = ""
}

# Monitoring variables
variable "enable_monitoring_dashboards" {
  description = "Enable creation of monitoring dashboards"
  type        = bool
  default     = true
}

variable "enable_monitoring_alerts" {
  description = "Enable creation of alerting policies"
  type        = bool
  default     = true
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 100
}

variable "budget_alert_thresholds" {
  description = "Budget alert thresholds (percentages)"
  type        = list(number)
  default     = [50, 80, 100]
}

variable "firebase_project_id" {
  type        = string
  description = "Firebase project id (not the numeric GCP project)"
}

variable "cors_allowed_origins" {
  type        = string
  description = "Comma-separated list of allowed CORS origins for API Gateway"
  default     = ""
}

