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

# Log-based metrics and sinks are temporarily disabled 
# to focus on core infrastructure deployment.
# These can be re-enabled once services are properly deployed.