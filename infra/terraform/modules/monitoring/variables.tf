# Monitoring Module Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "notification_channels" {
  description = "List of notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

variable "enable_dashboards" {
  description = "Enable creation of monitoring dashboards"
  type        = bool
  default     = true
}

variable "enable_alerts" {
  description = "Enable creation of alerting policies"
  type        = bool
  default     = true
}

variable "budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 100
}

variable "budget_thresholds" {
  description = "Budget alert thresholds (percentages)"
  type        = list(number)
  default     = [50, 80, 100]
}

variable "services" {
  description = "List of services to monitor"
  type        = list(string)
  default     = ["svc-authz", "svc-api-gateway", "worker-jobs"]
}