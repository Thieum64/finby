# 🚀 Test Plan - Phase 0 Deliverable

## Objectif
Vérifier que le service `svc-authz` est déployé et fonctionnel en Cloud Run avec logs et traces visibles.

## Prérequis
- ✅ Scripts de configuration GCP créés
- ✅ Monorepo initialisé avec Turborepo + pnpm  
- ✅ Service svc-authz build avec succès
- ✅ Infrastructure Terraform prête
- ✅ CI/CD GitHub Actions configuré
- ✅ Premier commit créé

## Plan de test

### 1. Mise à jour des paramètres personnalisés
```bash
# Éditer les scripts avec vos vraies valeurs:
# - scripts/login-gcloud.sh: BILLING_ID
# - scripts/configure-oidc.sh: GITHUB_REPO
# - infra/terraform/environments/dev/terraform.tfvars.example
```

### 2. Exécution des scripts d'initialisation
```bash
# 1. Prérequis Mac (si pas encore fait)
./scripts/install-dev-prereqs.sh

# 2. Authentification GCP  
./scripts/login-gcloud.sh

# 3. Infrastructure de base
./scripts/create-core-gcp.sh

# 4. Configuration OIDC GitHub
./scripts/configure-oidc.sh
```

### 3. Configuration GitHub Repository
1. Créer le repo GitHub: `<ton_github_owner>/<ton_repo>`
2. Push du code:
```bash
git remote add origin https://github.com/<ton_github_owner>/<ton_repo>.git
git push -u origin main
```
3. Configurer les variables GitHub Actions (Settings → Actions → Variables):
   - `GCP_PROJECT_ID`: hyperush-dev
   - `GCP_REGION`: europe-west1
   - `GCP_SERVICE_ACCOUNT`: deploy-sa@hyperush-dev.iam.gserviceaccount.com
   - `GCP_WORKLOAD_IDP`: (valeur générée par configure-oidc.sh)

### 4. Déploiement via CI/CD
```bash
# Déclenchement automatique du workflow svc-authz
git push origin main

# OU déploiement manuel via Terraform
cd infra/terraform/environments/dev
terraform init
terraform apply
```

### 5. Tests de vérification

#### ✅ Service accessible
```bash
# Récupérer l'URL du service
AUTHZ_URL=$(terraform output -raw svc_authz_url)

# Test endpoint racine
curl "$AUTHZ_URL/"
# Attendu: {"service":"svc-authz","version":"0.1.0","time":"...","reqId":"...","env":"development"}

# Test endpoint healthz  
curl "$AUTHZ_URL/healthz"
# Attendu: {"status":"healthy","timestamp":"...","checks":{"firestore":"not_implemented","secrets":"not_implemented"}}
```

#### ✅ Logs structurés visibles
```bash
# Via gcloud
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=svc-authz" --limit=10

# Via console GCP: https://console.cloud.google.com/logs/query
```

#### ✅ Traces Cloud Trace
```bash
# Via console GCP: https://console.cloud.google.com/traces/overview
# Vérifier qu'une trace apparaît après avoir fait une requête
```

### 6. Tests de charge légers
```bash
# Quelques requêtes pour générer des traces
for i in {1..10}; do
  curl -s "$AUTHZ_URL/" -H "x-request-id: test-req-$i" > /dev/null
  echo "Request $i sent"
done
```

## Critères d'acceptation Phase 0

- [ ] Service svc-authz déployé en Cloud Run (URL publique)
- [ ] Endpoint `/` répond avec les métadonnées du service
- [ ] Endpoint `/healthz` répond avec le status de santé  
- [ ] Request ID généré et propagé dans les logs
- [ ] Logs structurés JSON visibles dans Cloud Logging
- [ ] Traces visibles dans Cloud Trace pour chaque requête
- [ ] CI/CD fonctionnelle via OIDC (pas de clés d'accès dans le repo)
- [ ] Infrastructure source de vérité via Terraform
- [ ] Possibilité de détruire/recréer sans drift

## Troubleshooting

### Erreur de build
```bash
pnpm clean
pnpm install
pnpm --filter=@hyperush/svc-authz build
```

### Erreur de déploiement Terraform
```bash
# Vérifier les permissions
gcloud auth list
gcloud projects get-iam-policy hyperush-dev

# Re-appliquer
terraform destroy -target=module.svc_authz
terraform apply -target=module.svc_authz
```

### Service 5xx
```bash
# Vérifier les logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=svc-authz AND severity>=ERROR" --limit=20
```

---

**🎯 Une fois ces tests passés, le livrable Phase 0 est considéré comme accepté !**