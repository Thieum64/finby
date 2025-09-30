# Placeholder for Cloud Run Job - to be implemented in phase 0.4/0.9
# resource "google_cloud_run_v2_job" "this" {
#   name     = var.name
#   location = var.region
#   template {
#     template {
#       containers {
#         image = var.image
#       }
#     }
#   }
# }