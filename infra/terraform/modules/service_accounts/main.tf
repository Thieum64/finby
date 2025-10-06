# Service Accounts Module
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "service_accounts" {
  description = "List of service accounts to create"
  type = list(object({
    name         = string
    display_name = string
    description  = string
  }))
  default = []
}

# Create service accounts
resource "google_service_account" "accounts" {
  for_each = { for sa in var.service_accounts : sa.name => sa }

  project      = var.project_id
  account_id   = each.value.name
  display_name = each.value.display_name
  description  = each.value.description
}

# Output service account emails
output "service_account_emails" {
  description = "Email addresses of created service accounts"
  value       = { for k, v in google_service_account.accounts : k => v.email }
}

output "service_accounts" {
  description = "Service account resources"
  value       = google_service_account.accounts
}