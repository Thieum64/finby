terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Topics
resource "google_pubsub_topic" "requests" {
  name = "requests"
  
  labels = {
    environment = var.environment
    component   = "messaging"
  }

  message_retention_duration = "86400s" # 24 hours
}

resource "google_pubsub_topic" "jobs" {
  name = "jobs"
  
  labels = {
    environment = var.environment
    component   = "messaging"
  }

  message_retention_duration = "86400s" # 24 hours
}

resource "google_pubsub_topic" "notifications" {
  name = "notifications"
  
  labels = {
    environment = var.environment
    component   = "messaging"
  }

  message_retention_duration = "86400s" # 24 hours
}

# Dead Letter Queue Topic
resource "google_pubsub_topic" "dlq" {
  name = "dead-letter-queue"
  
  labels = {
    environment = var.environment
    component   = "messaging"
  }

  message_retention_duration = "604800s" # 7 days
}

# Subscriptions with Dead Letter Queue
resource "google_pubsub_subscription" "requests_sub" {
  name  = "requests-sub"
  topic = google_pubsub_topic.requests.name

  message_retention_duration = "86400s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 20

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    environment = var.environment
    component   = "messaging"
  }
}

resource "google_pubsub_subscription" "jobs_sub" {
  name  = "jobs-sub"
  topic = google_pubsub_topic.jobs.name

  message_retention_duration = "86400s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 20

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    environment = var.environment
    component   = "messaging"
  }
}

resource "google_pubsub_subscription" "notifications_sub" {
  name  = "notifications-sub"
  topic = google_pubsub_topic.notifications.name

  message_retention_duration = "86400s"
  retain_acked_messages      = false
  ack_deadline_seconds       = 20

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    environment = var.environment
    component   = "messaging"
  }
}

# DLQ Subscription
resource "google_pubsub_subscription" "dlq_sub" {
  name  = "dlq-sub"
  topic = google_pubsub_topic.dlq.name

  message_retention_duration = "604800s" # 7 days
  retain_acked_messages      = false
  ack_deadline_seconds       = 600 # 10 minutes for manual inspection

  labels = {
    environment = var.environment
    component   = "messaging"
  }
}