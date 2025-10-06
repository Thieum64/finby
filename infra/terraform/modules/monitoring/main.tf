# Monitoring Module - Dashboards, Alerts, and Budgets

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Enable required APIs
resource "google_project_service" "monitoring" {
  service = "monitoring.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "billingbudgets" {
  service = "billingbudgets.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false
}

# Data source for project's billing account (if available)
data "google_project" "current" {
  project_id = var.project_id
}

# Cloud Monitoring Dashboard - Overview
resource "google_monitoring_dashboard" "overview" {
  count = var.enable_dashboards ? 1 : 0

  dashboard_json = jsonencode({
    displayName = "HyperRush ${var.environment} - Overview"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 6
          height = 4
          widget = {
            title = "Cloud Run Services - Request Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields = ["resource.labels.service_name"]
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Requests/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width = 6
          height = 4
          xPos = 6
          widget = {
            title = "Cloud Run Services - Error Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND (response_code_class=\"4xx\" OR response_code_class=\"5xx\")"
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields = ["resource.labels.service_name"]
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Errors/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width = 6
          height = 4
          yPos = 4
          widget = {
            title = "Cloud Run Services - CPU Utilization"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND metric.type=\"run.googleapis.com/container/cpu/utilizations\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_MEAN"
                        crossSeriesReducer = "REDUCE_MEAN"
                        groupByFields = ["resource.labels.service_name"]
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "CPU %"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width = 6
          height = 4
          xPos = 6
          yPos = 4
          widget = {
            title = "Cloud Run Services - Memory Utilization"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND metric.type=\"run.googleapis.com/container/memory/utilizations\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_MEAN"
                        crossSeriesReducer = "REDUCE_MEAN"
                        groupByFields = ["resource.labels.service_name"]
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Memory %"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [google_project_service.monitoring]
}

# Cloud Monitoring Dashboard - Traces & Logs
resource "google_monitoring_dashboard" "traces_logs" {
  count = var.enable_dashboards ? 1 : 0

  dashboard_json = jsonencode({
    displayName = "HyperRush ${var.environment} - Traces & Logs"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width = 12
          height = 4
          widget = {
            title = "Trace Spans Count"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"gce_instance\" AND metric.type=\"cloudtrace.googleapis.com/trace_span_count\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Spans/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width = 6
          height = 4
          yPos = 4
          widget = {
            title = "Log Entries by Severity"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\""
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields = ["severity"]
                      }
                    }
                  }
                  plotType = "STACKED_AREA"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Log entries/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width = 6
          height = 4
          xPos = 6
          yPos = 4
          widget = {
            title = "Error Log Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND (severity>=ERROR OR jsonPayload.level=\"ERROR\")"
                      aggregation = {
                        alignmentPeriod = "60s"
                        perSeriesAligner = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields = ["resource.labels.service_name"]
                      }
                    }
                  }
                  plotType = "LINE"
                  targetAxis = "Y1"
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Error logs/sec"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [google_project_service.monitoring]
}

# Alert Policy - High Error Rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  count = var.enable_alerts ? 1 : 0

  display_name = "HyperRush ${var.environment} - High Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "High HTTP error rate"

    condition_threshold {
      filter         = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND (response_code_class=\"4xx\" OR response_code_class=\"5xx\")"
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 10

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields    = ["resource.labels.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.monitoring]
}

# Alert Policy - Service Down
resource "google_monitoring_alert_policy" "service_down" {
  count = var.enable_alerts ? 1 : 0

  display_name = "HyperRush ${var.environment} - Service Down"
  combiner     = "OR"

  conditions {
    display_name = "No requests for 5 minutes"

    condition_absent {
      filter   = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\""
      duration = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.monitoring]
}

# Alert Policy - High CPU Usage
resource "google_monitoring_alert_policy" "high_cpu" {
  count = var.enable_alerts ? 1 : 0

  display_name = "HyperRush ${var.environment} - High CPU Usage"
  combiner     = "OR"

  conditions {
    display_name = "CPU utilization > 80%"

    condition_threshold {
      filter         = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"svc-authz\" AND metric.type=\"run.googleapis.com/container/cpu/utilizations\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields    = ["resource.labels.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.monitoring]
}

# Budget Alert (disabled for now as it requires billing account setup)
# This can be enabled later by providing a billing account ID
# resource "google_billing_budget" "hyperush_budget" {
#   billing_account = "your-billing-account-id"
#   display_name    = "HyperRush ${var.environment} Monthly Budget"

#   budget_filter {
#     projects = ["projects/${var.project_id}"]
#   }

#   amount {
#     specified_amount {
#       currency_code = "USD"
#       units         = tostring(var.budget_amount)
#     }
#   }

#   dynamic "threshold_rules" {
#     for_each = var.budget_thresholds
#     content {
#       threshold_percent = threshold_rules.value / 100
#       spend_basis       = "CURRENT_SPEND"
#     }
#   }

#   all_updates_rule {
#     monitoring_notification_channels = var.notification_channels
#     disable_default_iam_recipients   = false
#   }
# }

# Log-based metrics for custom monitoring
resource "google_logging_metric" "request_latency" {
  name = "hyperush_request_latency_${var.environment}"

  filter = <<-EOF
    resource.type="cloud_run_revision"
    resource.labels.service_name=\"svc-authz\"
    httpRequest.latency!=""
  EOF

  value_extractor = "EXTRACT(httpRequest.latency)"

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DISTRIBUTION"
    display_name = "HyperRush Request Latency"
    labels {
      key         = "service"
      value_type  = "STRING"
      description = "Cloud Run service name"
    }
    labels {
      key         = "method"
      value_type  = "STRING"
      description = "HTTP request method"
    }
  }

  label_extractors = {
    service = "EXTRACT(resource.labels.service_name)"
    method  = "EXTRACT(httpRequest.requestMethod)"
  }

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 64
      growth_factor      = 2
      scale              = 0.01
    }
  }

  depends_on = [google_project_service.monitoring]
}

# Log-based metric for job processing
resource "google_logging_metric" "job_processing_count" {
  name = "hyperush_job_processing_count_${var.environment}"

  filter = <<-EOF
    resource.type="cloud_run_revision"
    resource.labels.service_name="worker-jobs"
    (
      jsonPayload.message=~".*Processing job.*" OR
      jsonPayload.message=~".*Job completed successfully.*"
    )
  EOF

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "INT64"
    display_name = "HyperRush Job Processing Count"
    labels {
      key         = "job_type"
      value_type  = "STRING"
      description = "Type of job being processed"
    }
    labels {
      key         = "status"
      value_type  = "STRING"
      description = "Job processing status"
    }
  }

  label_extractors = {
    job_type = "EXTRACT(jsonPayload.job_data.type)"
    status   = "EXTRACT(jsonPayload.message)"
  }

  depends_on = [google_project_service.monitoring]
}