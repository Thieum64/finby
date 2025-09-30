# Module repo commented out as hp-dev already exists in GCP
# module "repo" {
#   source = "../../modules/artifact_registry"
#   name   = "hp-dev"
#   region = var.repo_region
# }

module "requests_topic" {
  source = "../../modules/pubsub_topic"
  name   = "ps-requests"
  labels = { env = "dev" }
}

module "svc_authz" {
  source                = "../../modules/cloud_run_service"
  name                  = "svc-authz"
  region                = var.region
  image                 = var.svc_authz_image
  service_account_email = var.svc_authz_sa
  min_instances         = 0
  max_instances         = 2
  env = {
    NODE_ENV             = "development"
    OTEL_TRACES_EXPORTER = "none"
    BUILD_TIMESTAMP      = "20250930-1449"
  }
}

resource "google_cloud_run_v2_service_iam_member" "svc_authz_public" {
  project  = var.project_id
  location = var.region
  name     = module.svc_authz.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "svc_authz_url" {
  value = module.svc_authz.uri
}