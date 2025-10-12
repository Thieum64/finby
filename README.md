# Hyperush - Ultra-Modular Monorepo

Ultra-modular, cloud-native platform for Shopify app development and automation.

## 🚀 Quick Start

```bash
# 1. Install prerequisites (macOS)
./scripts/install-dev-prereqs.sh

# 2. Configure GCP and authentication
./scripts/login-gcloud.sh

# 3. Create core GCP infrastructure
./scripts/create-core-gcp.sh

# 4. Configure OIDC for GitHub Actions
./scripts/configure-oidc.sh

# 5. Install dependencies and start development
pnpm install
pnpm dev
```

## 🏗️ Architecture

### Services

- **Web** (`apps/web`) - Next.js frontend application
- **API Gateway** (`apps/api-gateway`) - BFF with rate limiting and auth
- **svc-authz** (`apps/svc-authz`) - Authentication & Authorization
- **svc-shops** (`apps/svc-shops`) - Shopify OAuth & shop management
- **svc-requests** (`apps/svc-requests`) - Request processing
- **svc-preview** (`apps/svc-preview`) - Theme preview generation
- **svc-ia-diff** (`apps/svc-ia-diff`) - AI-powered diff analysis
- **svc-quality** (`apps/svc-quality`) - Code quality checks
- **svc-billing** (`apps/svc-billing`) - Usage tracking & billing
- **svc-notify** (`apps/svc-notify`) - Notifications
- **svc-admin** (`apps/svc-admin`) - Platform administration

### Workers

- **worker-e2e** (`workers/worker-e2e`) - End-to-end testing jobs (Go)

### Packages

- **lib-common** - ULID, errors, idempotency, correlation
- **lib-firestore** - Multi-tenant Firestore repositories
- **lib-shopify** - Shopify API client with rate limiting
- **lib-git** - Internal Git repository management
- **lib-llm** - LLM provider abstraction with budgets
- **contracts** - OpenAPI specs, JSON schemas, protos

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Google Cloud SDK
- GitHub CLI
- Terraform

### Environment Setup

```bash
# Copy environment files
cp apps/svc-authz/.env.example apps/svc-authz/.env

# Configure direnv (optional)
direnv allow
```

### Running Services

```bash
# All services
pnpm dev

# Specific service
pnpm --filter=@hyperush/svc-authz dev

# Build all
pnpm build

# Test all
pnpm test

# Lint and format
pnpm lint
pnpm format
```

## 🚢 Deployment

### GitHub Actions Variables

Configure these in your repository settings:

- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - Deployment region (europe-west1)
- `GCP_SERVICE_ACCOUNT` - Deploy service account email
- `GCP_WORKLOAD_IDP` - Workload Identity Provider

### Manual Deployment

```bash
# Deploy specific service
cd infra/terraform/environments/dev
terraform init
terraform apply -target=module.svc_authz
```

### Infrastructure

- **GCP Cloud Run** - Containerized services
- **Firestore** - Multi-tenant document database
- **Pub/Sub** - Event-driven orchestration
- **Secret Manager** - Secure configuration
- **Artifact Registry** - Container images
- **Cloud Logging/Monitoring** - Observability

## 🔐 Security

- **Zero secrets in code** - All secrets via GCP Secret Manager
- **Multi-tenant by design** - All resources isolated by tenantId
- **Principle of least privilege** - Minimal IAM permissions
- **Request correlation** - Full traceability with reqId↔traceId
- **Idempotent operations** - Safe retry with idempotency keys

## 📊 Monitoring

- **Cloud Logging** - Structured JSON logs
- **Cloud Trace** - Distributed tracing
- **Cloud Monitoring** - Metrics and alerting
- **Health checks** - Built-in /healthz endpoints

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

## 🌐 Web Preview

[![Web Preview](https://github.com/thieum64/finby/actions/workflows/web-preview.yml/badge.svg)](https://github.com/thieum64/finby/actions/workflows/web-preview.yml)

Interactive web client for testing API endpoints directly from your browser:

- **Live Preview**: [https://thieum64.github.io/finby/](https://thieum64.github.io/finby/)
- Firebase authentication integration
- Test endpoints: Health, Me, Tenants, Roles, Check Access, Accept Invite
- No server dependencies - fully static

## 📚 Documentation

- [CI/CD Configuration](README-ci.md)
- [Conventions](docs/conventions.md)
- [Runbooks](ops/runbooks/)

## 🔧 Scripts

- `./scripts/install-dev-prereqs.sh` - Install development tools
- `./scripts/login-gcloud.sh` - GCP authentication setup
- `./scripts/create-core-gcp.sh` - Create base infrastructure
- `./scripts/configure-oidc.sh` - GitHub Actions OIDC setup

## 📦 Package Structure

```
apps/                    # Applications
├── web/                # Next.js frontend
├── api-gateway/        # BFF
├── svc-*/             # Microservices
└── ...

packages/               # Shared libraries
├── lib-common/        # Common utilities
├── lib-firestore/     # Database layer
├── contracts/         # API contracts
└── ...

workers/               # Background jobs
└── worker-e2e/       # Go testing worker

infra/                 # Infrastructure as code
└── terraform/         # Terraform modules

ops/                   # Operations
├── dashboards/        # Monitoring dashboards
├── runbooks/          # Incident response
└── alerts.json        # Alert configurations
```

## 🎯 Roadmap

- **M0** ✅ - Project bootstrap, svc-authz deployment
- **M1** - OpenTelemetry, logging, basic observability
- **M2** - Firebase Auth, tenant management, RBAC
- **M3** - Shopify OAuth, shop management
- **M4** - Request processing, job orchestration
- **M5** - AI diff analysis, quality checks
- **M6** - Theme preview generation
- **M7** - Billing, usage tracking
- **M8** - Notifications, admin dashboard
- **M9** - Advanced monitoring, alerts
- **M10** - Performance optimization
- **M11** - Security hardening
- **M12** - Documentation, training
- **M13** - Production launch

---

**Generated with ultra-modular principles • Multi-tenant by design • Security first**
