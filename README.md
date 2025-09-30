# Hyperush — Monorepo

- Tooling: pnpm, Turborepo, Husky, Commitlint, Prettier, ESLint
- Node: see .nvmrc
- Workspaces: apps/, packages/, infra/, ops/

## Quickstart:

```
pnpm install
pnpm build
```

## Infra dev (0.2)

### Prerequisites

- Terraform >= 1.6.0
- Google Cloud SDK configured
- Authentication for project `hyperush-dev-250930115246`

### Deployment Steps

```bash
# Navigate to dev environment
cd infra/terraform/envs/dev

# Initialize and apply infrastructure
terraform init
terraform plan
terraform apply -auto-approve

# Get service outputs
terraform output -raw svc_authz_url
```

### Infrastructure Outputs

- **svc_authz_url**: Cloud Run service URL for svc-authz
- **Pub/Sub Topic**: ps-requests (for async messaging)
- **Artifact Registry**: hp-dev (Docker images)

### Quick Test

```bash
# Test the deployed service
curl "$(terraform output -raw svc_authz_url)/healthz"
# Expected: {"ok":true,"service":"svc-authz"}
```
