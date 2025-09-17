variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "runtime_service_account" {
  description = "Service account email for runtime"
  type        = string
}

variable "image" {
  description = "Container image URI"
  type        = string
}

variable "env_vars" {
  description = "Additional environment variables"
  type        = map(string)
  default     = {}
}
# Optional variables for terraform imports compatibility
variable "container_concurrency" {
  description = "Container concurrency limit"
  type        = number
  default     = null
}

variable "port" {
  description = "Container port"
  type        = number
  default     = null
}

variable "ingress" {
  description = "Ingress configuration"
  type        = string
  default     = null
}

variable "execution_environment" {
  description = "Execution environment"
  type        = string
  default     = null
}
