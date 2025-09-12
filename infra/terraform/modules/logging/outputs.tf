output "metrics" {
  description = "Map of created log-based metrics (temporarily disabled)"
  value = {}
}

output "log_sink" {
  description = "Error log sink information (temporarily disabled)"
  value = {}
}

output "enabled_apis" {
  description = "List of enabled APIs"
  value = [
    google_project_service.logging.service,
    google_project_service.monitoring.service,
    google_project_service.cloudtrace.service
  ]
}