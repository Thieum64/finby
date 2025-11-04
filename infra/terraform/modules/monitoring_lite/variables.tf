variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "service" {
  description = "Service name to monitor"
  type        = string
  default     = "svc-authz"
}