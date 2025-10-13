output "secrets" {
  description = "Map of secret names to their resource names"
  value = {
    stripe_secret            = google_secret_manager_secret.stripe_secret.secret_id
    firebase_sa_json         = google_secret_manager_secret.firebase_sa_json.secret_id
  }
}

output "secret_ids" {
  description = "Map of secret names to their full resource IDs"
  value = {
    stripe_secret            = google_secret_manager_secret.stripe_secret.id
    firebase_sa_json         = google_secret_manager_secret.firebase_sa_json.id
  }
}