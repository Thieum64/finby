# Monitoring Module Outputs

output "dashboard_urls" {
  description = "URLs of created monitoring dashboards"
  value = {
    overview    = var.enable_dashboards ? "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.overview[0].id}?project=${var.project_id}" : null
    traces_logs = var.enable_dashboards ? "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.traces_logs[0].id}?project=${var.project_id}" : null
  }
}

output "alert_policy_ids" {
  description = "IDs of created alert policies"
  value = var.enable_alerts ? {
    high_error_rate = google_monitoring_alert_policy.high_error_rate[0].name
    service_down    = google_monitoring_alert_policy.service_down[0].name
    high_cpu        = google_monitoring_alert_policy.high_cpu[0].name
  } : {}
}

output "budget_name" {
  description = "Name of the created budget (disabled currently)"
  value       = "Budget creation disabled - requires billing account setup"
}

output "log_metrics" {
  description = "Names of created log-based metrics"
  value = {
    request_latency      = google_logging_metric.request_latency.name
    job_processing_count = google_logging_metric.job_processing_count.name
  }
}

output "monitoring_console_url" {
  description = "URL to Google Cloud Monitoring console"
  value       = "https://console.cloud.google.com/monitoring?project=${var.project_id}"
}