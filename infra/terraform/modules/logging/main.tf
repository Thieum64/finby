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

# Log-based metric for job failures
resource "google_logging_metric" "job_failed_count" {
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

  label_extractors = {
    service = "EXTRACT(labels.\"k8s-pod/serving.knative.dev/service\")"
    error_type = "EXTRACT(jsonPayload.error)"
  }

  metric_descriptor {
    metric_kind = "CUMULATIVE"
    value_type  = "INT64"
    display_name = "Hyperush Job Failed Count"
    
    labels {
      key         = "service"
      value_type  = "STRING"
      description = "The service where the job failed"
    }
    
    labels {
      key         = "error_type"
      value_type  = "STRING"
      description = "Type of error that caused the failure"
    }
  }

  depends_on = [google_project_service.logging]
}

# Log-based metric for request count
resource "google_logging_metric" "request_count" {
  name = "hyperush_request_count"
  
  filter = <<-EOF
    resource.type="cloud_run_revision"
    labels."k8s-pod/serving.knative.dev/service"=~"svc-.*"
    httpRequest.requestMethod!=""
  EOF

  label_extractors = {
    service = "EXTRACT(labels.\"k8s-pod/serving.knative.dev/service\")"
    method = "EXTRACT(httpRequest.requestMethod)"
    status = "EXTRACT(httpRequest.status)"
  }

  metric_descriptor {
    metric_kind = "CUMULATIVE"
    value_type  = "INT64"
    display_name = "Hyperush Request Count"
    
    labels {
      key         = "service"
      value_type  = "STRING"
      description = "The service handling the request"
    }
    
    labels {
      key         = "method"
      value_type  = "STRING"
      description = "HTTP method of the request"
    }
    
    labels {
      key         = "status"
      value_type  = "STRING"
      description = "HTTP status code of the response"
    }
  }

  depends_on = [google_project_service.logging]
}

# Log sink for error analysis (optional - sends errors to a separate log bucket)
resource "google_logging_project_sink" "error_sink" {
  name = "hyperush-error-sink"
  
  destination = "logging.googleapis.com/projects/${var.project_id}/logs/hyperush-errors"
  
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