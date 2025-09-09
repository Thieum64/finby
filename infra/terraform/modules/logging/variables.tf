variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}