terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Dashboard simple avec un chart XY pour les requêtes
resource "google_monitoring_dashboard" "lite_dashboard" {
  project        = var.project_id

  dashboard_json = jsonencode({
    displayName = "HyperRush Lite Dashboard"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Requests per minute (svc-authz)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\""
                      aggregation = {
                        alignmentPeriod   = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                      }
                    }
                    unitOverride = "1/min"
                  }
                  plotType   = "LINE"
                  targetAxis = "Y1"
                }
              ]
              yAxis = {
                label = "Requests/min"
                scale = "LINEAR"
              }
              chartOptions = {
                mode = "COLOR"
              }
            }
          }
        }
      ]
    }
  })
}

# Alert Policy 1: High 5xx rate
resource "google_monitoring_alert_policy" "high_5xx_rate" {
  project      = var.project_id
  display_name = "High 5xx rate - svc-authz"
  combiner     = "OR"

  conditions {
    display_name = "5xx rate too high"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND metric.label.response_code_class=\"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  enabled = true
}

# Alert Policy 2: No requests in 5 minutes
resource "google_monitoring_alert_policy" "no_requests_5m" {
  project      = var.project_id
  display_name = "No requests in 5 minutes - svc-authz"
  combiner     = "OR"

  conditions {
    display_name = "No requests detected"

    condition_absent {
      filter   = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\""
      duration = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  enabled = true
}