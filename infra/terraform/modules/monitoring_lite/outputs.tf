output "dashboard_name" {
  description = "Name of the monitoring dashboard"
  value       = google_monitoring_dashboard.lite_dashboard.id
}

output "dashboard_url" {
  description = "URL of the monitoring dashboard"
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.lite_dashboard.id}?project=${var.project_id}"
}

output "alert_policy_ids" {
  description = "IDs of created alert policies"
  value = [
    google_monitoring_alert_policy.high_5xx_rate.id,
    google_monitoring_alert_policy.no_requests_5m.id
  ]
}