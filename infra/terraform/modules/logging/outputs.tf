output "metrics" {
  description = "Map of created log-based metrics"
  value = {
    job_failed_count = google_logging_metric.job_failed_count.name
    request_count    = google_logging_metric.request_count.name
  }
}

output "log_sink" {
  description = "Error log sink information"
  value = {
    name        = google_logging_project_sink.error_sink.name
    destination = google_logging_project_sink.error_sink.destination
  }
}

output "enabled_apis" {
  description = "List of enabled APIs"
  value = [
    google_project_service.logging.service,
    google_project_service.monitoring.service,
    google_project_service.cloudtrace.service
  ]
}