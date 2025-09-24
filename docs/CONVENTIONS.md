# Conventions Hyperush

## Nommage (GCP)

- Projet: hyperush-{env}
- Cloud Run service: svc-{domaine} (ex: svc-authz)
- Cloud Run job: job-{nom}
- Pub/Sub topic: ps-{topic}
- Secret: {env}/{service}/{name}
- Buckets: gs://hyperush-{env}-{purpose}
- Artifact Registry: europe-west1-docker.pkg.dev/hyperush-{env}/repo

## Tenancy & IDs

- ULID partout: reqId, jobId, commit tag
- tenantId porté par chaque ressource; shop: tenantId + shopId

## Branching & Releases

- Trunk-based sur main
- Tags: {service}/vX.Y.Z

## Commits (Conventional Commits)

- type(scope): message
- Scopes: infra, svc-\*, web, data, security, compliance, ops, docs, contract-tests, e2e

## Dossiers Monorepo

- apps/\*: services & BFF
- packages/\*: libs partagées (type-safe)
- infra/terraform: IaC modulaire
- ops/runbooks: runbooks, dashboards, alerts

## Sécurité

- Zéro secret en image
- Secrets uniquement via Secret Manager
- Logs caviardés (tokens/emails)

## Observabilité

- OTel: propagation traceparent UI→GW→svc
- Logs JSON structurés (reqId, tenantId, shopId, stage)
