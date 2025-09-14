variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

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

variable "sink_destination_bucket" {
  description = "GCS bucket for error log sink (required if enable_error_sink=true)"
  type        = string
  default     = ""
}