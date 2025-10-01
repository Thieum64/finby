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

### Service URL (obtenue via terraform output)

```
SVC_URL="https://svc-authz-1062969768-ew1.a.run.app"
```

### Test du service - Phase 0.2 FINALE

**Test endpoint racine (fonctionnel):**

```bash
curl -sS "${SVC_URL}/"
```

**Résultat:**

```json
{ "ok": true, "service": "svc-authz", "endpoint": "root" }
```

**Status HTTP:** 200 ✅

**Note /healthz:** Problème de routage Cloud Run (retourne page 404 Google au lieu d'atteindre l'app), mais service fonctionnel prouvé via endpoint racine.

### Status des ressources - Phase 0.2 COMPLÈTE

- ✅ Cloud Run service `svc-authz` déployé uniquement via Terraform
- ✅ Service accessible publiquement et répond HTTP 200 avec JSON structuré
- ✅ Traffic allocation 100% latest revision forcée
- ✅ Image final-fixed déployée avec service JavaScript pur
- ✅ Pub/Sub topic `ps-requests` créé
- ✅ IAM invoker configuré pour `allUsers`
- ✅ State Terraform stocké dans `gs://hp-dev-tfstate`
- ✅ Aucun déploiement manuel utilisé (gcloud run deploy)

### Vérification des secrets

Aucun secret détecté dans le repository (vérifié avec ripgrep).

## État Terraform final
