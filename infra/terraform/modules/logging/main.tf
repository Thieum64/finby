terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Enable required APIs
resource "google_project_service" "logging" {
  service = "logging.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "monitoring" {
  service = "monitoring.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "cloudtrace" {
  service = "cloudtrace.googleapis.com"
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

# Log-based metric for job failures (conditional)
resource "google_logging_metric" "job_failed_count" {
  count = var.enable_metrics ? 1 : 0
  
  name = "hyperush_job_failed_count"
  
  filter = <<-EOF
    resource.type="cloud_run_revision"
    labels."k8s-pod/serving.knative.dev/service"=~"svc-.*"
    (
      jsonPayload.level="ERROR" OR
      jsonPayload.level="FATAL" OR
      severity>=ERROR
    )
    (
      jsonPayload.message=~".*job.*failed.*" OR
      jsonPayload.message=~".*task.*error.*" OR
      jsonPayload.error=~".*"
    )
  EOF


  depends_on = [google_project_service.logging]
}

# Log-based metric for request count (conditional)
resource "google_logging_metric" "request_count" {
  count = var.enable_metrics ? 1 : 0
  
  name = "hyperush_request_count"
  
  filter = <<-EOF
    resource.type="cloud_run_revision"
    labels."k8s-pod/serving.knative.dev/service"=~"svc-.*"
    httpRequest.requestMethod!=""
  EOF


  depends_on = [google_project_service.logging]
}

# Error log sink (conditional, requires bucket)
resource "google_logging_project_sink" "error_sink" {
  count = var.enable_error_sink && var.sink_destination_bucket != "" ? 1 : 0
  
  name = "hyperush-error-sink"
  
  destination = "storage.googleapis.com/${var.sink_destination_bucket}"
  
  filter = <<-EOF
    resource.type="cloud_run_revision"
    labels."k8s-pod/serving.knative.dev/service"=~"svc-.*"
    (
      severity>=ERROR OR
      jsonPayload.level="ERROR" OR
      jsonPayload.level="FATAL"
    )
  EOF

  unique_writer_identity = true
  
  depends_on = [google_project_service.logging]
}