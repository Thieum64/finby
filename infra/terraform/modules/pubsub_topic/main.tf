resource "google_pubsub_topic" "this" {
  name                       = var.name
  message_retention_duration = var.retention
  labels                     = var.labels
}