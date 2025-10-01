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

### Test du service - Phase 0.2 FINALE v7 avec /health

**Test /health (SUCCÈS):**

```bash
curl -i -sS "${SVC_URL}/health"
```

**Résultat:**

```
HTTP/2 200
x-powered-by: Express
content-type: application/json; charset=utf-8
date: Wed, 01 Oct 2025 08:10:44 GMT

{"ok":true,"service":"svc-authz"}
```

**Status HTTP:** 200 ✅

**Test endpoint racine (fonctionnel):**

```bash
curl -i -sS "${SVC_URL}/"
```

**Résultat:**

```
HTTP/2 200
x-powered-by: Express
content-type: application/json; charset=utf-8
date: Wed, 01 Oct 2025 08:10:50 GMT

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
date: Wed, 01 Oct 2025 08:10:52 GMT

{"ok":true,"service":"svc-authz","endpoint":"catchall"}
```

**Status HTTP:** 200 ✅

**Logs Cloud Run (preuve que /health atteint bien l'app):**

```
REQ GET /health
svc-authz v7 listening on 8080
```

**Note:** ✅ Ligne "REQ GET /health" présente dans les logs → /health atteint correctement Express.

### Status des ressources - Phase 0.2 FINALE ✅

- ✅ Cloud Run service `svc-authz` déployé uniquement via Terraform (image v7)
- ✅ Service accessible publiquement et répond HTTP 200 avec JSON structuré
- ✅ Traffic allocation 100% latest revision forcée
- ✅ Endpoint `/health` fonctionnel (atteint correctement Express)
- ✅ Catch-all endpoint fonctionnel (prouve que l'app reçoit le trafic)
- ✅ Pub/Sub topic `ps-requests` créé
- ✅ IAM invoker configuré pour `allUsers`
- ✅ State Terraform stocké dans `gs://hp-dev-tfstate`
- ✅ Aucun déploiement manuel utilisé (gcloud run deploy)

**CONCLUSION:** Phase 0.2 RÉUSSIE. Service déployé via Terraform only avec endpoint `/health` fonctionnel.

**APPRENTISSAGE:** `/healthz` est réservé par Google Cloud. Utiliser `/health` ou `/.well-known/health` pour les healthchecks custom.

### Vérification des secrets

Aucun secret détecté dans le repository (vérifié avec ripgrep).

## État Terraform final
