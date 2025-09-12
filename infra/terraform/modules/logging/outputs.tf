output "metrics" {
  description = "Map of created log-based metrics"
  value = {
    job_failed_count = var.enable_metrics ? google_logging_metric.job_failed_count[0].name : null
    request_count    = var.enable_metrics ? google_logging_metric.request_count[0].name : null
  }
}

output "log_sink" {
  description = "Error log sink information"
  value = var.enable_error_sink && var.sink_destination_bucket != "" ? {
    name        = google_logging_project_sink.error_sink[0].name
    destination = google_logging_project_sink.error_sink[0].destination
  } : null
}

output "enabled_apis" {
  description = "List of enabled APIs"
  value = [
    google_project_service.logging.service,
    google_project_service.monitoring.service,
    google_project_service.cloudtrace.service
  ]
}