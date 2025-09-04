#!/bin/bash
set -euo pipefail

# Configuration
PROJECT_ID="hyperush-dev"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
DEPLOY_SA="deploy-sa"

# Check required environment variables
if [ -z "$GITHUB_REPO" ]; then
    echo "❌ Erreur: La variable GITHUB_REPO doit être définie"
    echo "   Exemple: export GITHUB_REPO='owner/repo-name'"
    echo "   Format: owner/repository (ex: timmsss/hyperush)"
    exit 1
fi

echo "🔗 Configuration de l'OIDC GitHub Actions → GCP..."

# Create Workload Identity Pool
POOL_ID="github-actions-pool"
POOL_DISPLAY_NAME="GitHub Actions Pool"

echo "🏊 Création du Workload Identity Pool..."
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location="global" &>/dev/null; then
    gcloud iam workload-identity-pools create "$POOL_ID" \
        --location="global" \
        --display-name="$POOL_DISPLAY_NAME" \
        --description="Workload Identity Pool for GitHub Actions"
    echo "✅ Pool $POOL_ID créé"
else
    echo "✅ Pool $POOL_ID existe déjà"
fi

# Create Workload Identity Provider
PROVIDER_ID="github-actions-provider"
PROVIDER_DISPLAY_NAME="GitHub Actions Provider"

echo "🔌 Création du Workload Identity Provider..."
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --location="global" \
    --workload-identity-pool="$POOL_ID" &>/dev/null; then
    
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
        --location="global" \
        --workload-identity-pool="$POOL_ID" \
        --display-name="$PROVIDER_DISPLAY_NAME" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    echo "✅ Provider $PROVIDER_ID créé"
else
    echo "✅ Provider $PROVIDER_ID existe déjà"
fi

# Bind Service Account to Workload Identity
DEPLOY_SA_EMAIL="$DEPLOY_SA@$PROJECT_ID.iam.gserviceaccount.com"
WORKLOAD_IDENTITY_USER="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository/$GITHUB_REPO"

echo "🔗 Association du Service Account avec le Workload Identity..."
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="$WORKLOAD_IDENTITY_USER"

echo -e "\n📋 Variables à configurer dans GitHub Actions:"
echo "Repository: https://github.com/$GITHUB_REPO"
echo "Allez dans Settings → Secrets and variables → Actions → Variables"
echo ""
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_REGION: europe-west1"
echo "GCP_SERVICE_ACCOUNT: $DEPLOY_SA_EMAIL"
echo "GCP_WORKLOAD_IDP: projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID"
echo ""

# Create README for CI/CD
cat > README-ci.md << 'EOF'
# CI/CD Configuration

## Variables GitHub Actions

Configurez ces variables dans votre repo GitHub (Settings → Secrets and variables → Actions → Variables):

- `GCP_PROJECT_ID`: ID du projet GCP
- `GCP_REGION`: Région de déploiement (europe-west1)
- `GCP_SERVICE_ACCOUNT`: Email du service account de déploiement
- `GCP_WORKLOAD_IDP`: Workload Identity Provider complet

## Stratégie de déploiement

### Images par tag SHA
- **dev**: Déploiement automatique sur push `main`
- **stage**: Promotion manuelle avec tag `stage-v*`
- **prod**: Promotion manuelle avec tag `prod-v*`

### Workflow de promotion
1. Image buildée avec SHA commit: `sha-abc123`
2. Tag dev: `europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:sha-abc123`
3. Promotion stage: retag de la même image `sha-abc123` → `stage-v1.0.0`
4. Promotion prod: retag de la même image `sha-abc123` → `prod-v1.0.0`

**Avantage**: Pas de rebuild, même artefact du dev à la prod.

### Commandes utiles

```bash
# Promouvoir une image dev vers stage
gcloud artifacts docker tags add \
  europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:sha-abc123 \
  europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:stage-v1.0.0

# Déployer en stage
gcloud run deploy svc-authz-stage \
  --image europe-west1-docker.pkg.dev/hyperush-dev/services/svc-authz:stage-v1.0.0 \
  --region europe-west1
```
EOF

echo "✅ Configuration OIDC terminée !"
echo "📖 Consultez README-ci.md pour les détails du CI/CD"