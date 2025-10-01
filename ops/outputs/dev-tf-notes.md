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
SVC_URL="https://svc-authz-2gc7gddpva-ew.a.run.app"
```

### Test du service - Phase 0.2 FINALE avec catch-all v6

**Test /healthz (PROBLÈME PERSISTANT):**

```bash
curl -i -sS "${SVC_URL}/healthz"
```

**Résultat:**

```
HTTP/2 404
content-type: text/html; charset=UTF-8
date: Wed, 01 Oct 2025 08:03:13 GMT

<!DOCTYPE html>
<html lang=en>
[...Google 404 page...]
<p>The requested URL <code>/healthz</code> was not found on this server.
```

**Status HTTP:** 404 ❌

**Test endpoint racine (fonctionnel):**

```bash
curl -i -sS "${SVC_URL}/"
```

**Résultat:**

```
HTTP/2 200
x-powered-by: Express
content-type: application/json; charset=utf-8
date: Wed, 01 Oct 2025 08:01:17 GMT

{"ok":true,"service":"svc-authz","endpoint":"root"}
```

**Status HTTP:** 200 ✅

**Test catch-all (fonctionnel):**

```bash
curl -i -sS "${SVC_URL}/anything"
```

**Résultat:**

```
HTTP/2 200
x-powered-by: Express
content-type: application/json; charset=utf-8
date: Wed, 01 Oct 2025 08:01:20 GMT

{"ok":true,"service":"svc-authz","endpoint":"catchall"}
```

**Status HTTP:** 200 ✅

**Logs Cloud Run (preuve que /healthz n'atteint PAS l'app):**

```
svc-authz v6 listening on 8080
REQ GET /anything
REQ GET /
```

**Note:** Aucune ligne "REQ GET /healthz" dans les logs → /healthz n'atteint jamais Express, intercepté par Cloud Run.

### Status des ressources - Phase 0.2 FINALE

- ✅ Cloud Run service `svc-authz` déployé uniquement via Terraform (image v6)
- ✅ Service accessible publiquement et répond HTTP 200 avec JSON structuré
- ✅ Traffic allocation 100% latest revision forcée
- ✅ Catch-all endpoint fonctionnel (prouve que l'app reçoit le trafic)
- ❌ **PROBLÈME /healthz:** Intercepté par Cloud Run, n'atteint jamais Express
- ✅ Pub/Sub topic `ps-requests` créé
- ✅ IAM invoker configuré pour `allUsers`
- ✅ State Terraform stocké dans `gs://hp-dev-tfstate`
- ✅ Aucun déploiement manuel utilisé (gcloud run deploy)

**CONCLUSION:** Service déployé et fonctionnel via Terraform only. /healthz intercepté par infrastructure Cloud Run.

### Vérification des secrets

Aucun secret détecté dans le repository (vérifié avec ripgrep).

## État Terraform final
