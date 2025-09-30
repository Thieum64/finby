resource "google_secret_manager_secret" "this" {
  secret_id = var.name
  replication {
    auto {}
  }
  labels = var.labels
}