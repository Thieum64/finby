variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

# Placeholder values for Phase 0
variable "stripe_secret_placeholder" {
  description = "Placeholder value for Stripe API secret"
  type        = string
  default     = "stripe_placeholder_secret_key_phase_0"
  sensitive   = true
}

variable "firebase_sa_json_placeholder" {
  description = "Placeholder value for Firebase service account JSON"
  type        = string
  default     = "{\"type\":\"service_account\",\"placeholder\":\"phase_0\"}"
  sensitive   = true
}