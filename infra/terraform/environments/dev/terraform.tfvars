# Dev Environment Configuration
project_id              = "hyperush-dev-250930115246"
region                  = "europe-west1"
runtime_service_account = "svc-authz-sa@hyperush-dev-250930115246.iam.gserviceaccount.com"
svc_authz_image         = "europe-west1-docker.pkg.dev/hyperush-dev-250930115246/hp-dev/svc-authz:271d7203731b"
enable_metrics          = true
enable_error_sink       = false
svc_api_gateway_image   = "europe-west1-docker.pkg.dev/hyperush-dev-250930115246/hp-dev/svc-api-gateway:ac3767aa1c51"
worker_subscriber_image = "europe-west1-docker.pkg.dev/hyperush-dev-250930115246/hp-dev/worker-subscriber:ac3767a"
