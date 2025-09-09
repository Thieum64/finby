terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Stripe API Secret
resource "google_secret_manager_secret" "stripe_secret" {
  secret_id = "stripe-api-secret"

  labels = {
    environment = var.environment
    component   = "billing"
    type        = "api-key"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "stripe_secret" {
  secret      = google_secret_manager_secret.stripe_secret.id
  secret_data = var.stripe_secret_placeholder
}

# Shopify Webhook Secret
resource "google_secret_manager_secret" "shopify_webhook_secret" {
  secret_id = "shopify-webhook-secret"

  labels = {
    environment = var.environment
    component   = "shops"
    type        = "webhook-secret"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "shopify_webhook_secret" {
  secret      = google_secret_manager_secret.shopify_webhook_secret.id
  secret_data = var.shopify_webhook_secret_placeholder
}

# Firebase Service Account JSON
resource "google_secret_manager_secret" "firebase_sa_json" {
  secret_id = "firebase-service-account-json"

  labels = {
    environment = var.environment
    component   = "auth"
    type        = "service-account"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "firebase_sa_json" {
  secret      = google_secret_manager_secret.firebase_sa_json.id
  secret_data = var.firebase_sa_json_placeholder
}