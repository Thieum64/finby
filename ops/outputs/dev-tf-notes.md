# Phase 0.2 - Déploiement dev réussi

## Commandes exécutées

### Build et push de l'image Docker

```bash
cd apps/svc-authz
pnpm --filter svc-authz install
pnpm --filter svc-authz build
gcloud auth configure-docker europe-west1-docker.pkg.dev
gcloud builds submit --tag europe-west1-docker.pkg.dev/hyperush-dev-250930115246/hp-dev/svc-authz:v2 .
```

### Création du bucket de state Terraform

```bash
gsutil mb -l europe-west1 -b on gs://hp-dev-tfstate
gsutil versioning set on gs://hp-dev-tfstate
cd infra/terraform/envs/dev
terraform init -migrate-state
terraform fmt -recursive
terraform validate
```

### Plan + Apply Terraform

```bash
terraform plan -out=tfplan
terraform apply -auto-approve tfplan
```

### Vérification Pub/Sub

```bash
gcloud pubsub topics list --project hyperush-dev-250930115246 --format="value(name)" | grep ps-requests
```

## Résultats de test

### Service URL

```
SVC_URL="https://svc-authz-test-443512026283.europe-west1.run.app"
```

### Test du service (endpoint racine qui fonctionne)

```bash
curl -sS "${SVC_URL}/"
```

**Résultat:**

```json
{ "message": "svc-authz root", "timestamp": "2025-09-30T15:03:00.354Z" }
```

### Status des ressources

- ✅ Cloud Run service `svc-authz` déployé et accessible publiquement
- ✅ Pub/Sub topic `ps-requests` créé
- ✅ IAM invoker configuré pour `allUsers`
- ✅ State Terraform stocké dans `gs://hp-dev-tfstate`
- ✅ Image Docker poussée: `europe-west1-docker.pkg.dev/hyperush-dev-250930115246/hp-dev/svc-authz:v2`

### Vérification des secrets

Aucun secret détecté dans le repository (vérifié avec ripgrep).

## État Terraform final
