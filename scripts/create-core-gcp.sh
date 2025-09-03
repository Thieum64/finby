#!/bin/bash
set -euo pipefail

# Configuration
PROJECT_ID="hyperush-dev"
REGION="europe-west1"
FIRESTORE_LOCATION="eur3"

echo "🏗️  Création de l'infrastructure GCP de base..."

# Create Artifact Registry repository
echo "📦 Création du registry Artifact Registry..."
REGISTRY_NAME="services"
if ! gcloud artifacts repositories describe "$REGISTRY_NAME" --location="$REGION" &>/dev/null; then
    gcloud artifacts repositories create "$REGISTRY_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker images for microservices"
    echo "✅ Registry $REGISTRY_NAME créé"
else
    echo "✅ Registry $REGISTRY_NAME existe déjà"
fi

# Create Firestore database
echo "🗄️  Configuration de Firestore..."
if ! gcloud firestore databases describe --database="(default)" &>/dev/null; then
    gcloud firestore databases create --database="(default)" --location="$FIRESTORE_LOCATION"
    echo "✅ Base Firestore créée en $FIRESTORE_LOCATION"
else
    echo "✅ Base Firestore existe déjà"
fi

# Create Pub/Sub topics and subscriptions
echo "📡 Création des topics Pub/Sub..."
topics=("requests" "jobs" "notifications")

for topic in "${topics[@]}"; do
    if ! gcloud pubsub topics describe "$topic" &>/dev/null; then
        gcloud pubsub topics create "$topic"
        echo "✅ Topic $topic créé"
    else
        echo "✅ Topic $topic existe déjà"
    fi
    
    # Create subscription for each topic
    subscription="${topic}-sub"
    if ! gcloud pubsub subscriptions describe "$subscription" &>/dev/null; then
        gcloud pubsub subscriptions create "$subscription" --topic="$topic"
        echo "✅ Subscription $subscription créée"
    else
        echo "✅ Subscription $subscription existe déjà"
    fi
done

# Create service accounts
echo "👤 Création des comptes de service..."

# Deploy service account (for CI/CD)
DEPLOY_SA="deploy-sa"
DEPLOY_SA_EMAIL="$DEPLOY_SA@$PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" &>/dev/null; then
    gcloud iam service-accounts create "$DEPLOY_SA" \
        --display-name="Deployment Service Account" \
        --description="Used by CI/CD for deployments"
    echo "✅ Service Account $DEPLOY_SA créé"
else
    echo "✅ Service Account $DEPLOY_SA existe déjà"
fi

# Runtime service account (for Cloud Run services)
RUNTIME_SA="runtime-sa"
RUNTIME_SA_EMAIL="$RUNTIME_SA@$PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" &>/dev/null; then
    gcloud iam service-accounts create "$RUNTIME_SA" \
        --display-name="Runtime Service Account" \
        --description="Used by Cloud Run services at runtime"
    echo "✅ Service Account $RUNTIME_SA créé"
else
    echo "✅ Service Account $RUNTIME_SA existe déjà"
fi

# Assign minimal IAM roles
echo "🔐 Attribution des rôles IAM minimaux..."

# Deploy SA permissions
deploy_roles=(
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/cloudbuild.builds.editor"
    "roles/iam.serviceAccountUser"
)

for role in "${deploy_roles[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$DEPLOY_SA_EMAIL" \
        --role="$role" \
        --quiet
done

# Runtime SA permissions
runtime_roles=(
    "roles/datastore.user"
    "roles/pubsub.publisher"
    "roles/pubsub.subscriber"
    "roles/secretmanager.secretAccessor"
    "roles/logging.logWriter"
    "roles/monitoring.metricWriter"
    "roles/cloudtrace.agent"
)

for role in "${runtime_roles[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$RUNTIME_SA_EMAIL" \
        --role="$role" \
        --quiet
done

# Create initial secrets
echo "🔒 Création des secrets de base..."
secrets=("stripe-secret-key" "firebase-service-account" "shopify-webhook-secret")

for secret in "${secrets[@]}"; do
    if ! gcloud secrets describe "$secret" &>/dev/null; then
        echo "placeholder" | gcloud secrets create "$secret" --data-file=-
        echo "✅ Secret $secret créé (placeholder)"
    else
        echo "✅ Secret $secret existe déjà"
    fi
done

echo -e "\n🔍 Résumé de l'infrastructure créée:"
echo "📦 Artifact Registry: $REGION-docker.pkg.dev/$PROJECT_ID/$REGISTRY_NAME"
echo "🗄️  Firestore: Base par défaut en $FIRESTORE_LOCATION"
echo "📡 Pub/Sub: Topics et subscriptions créés"
echo "👤 Service Accounts: $DEPLOY_SA_EMAIL, $RUNTIME_SA_EMAIL"
echo "🔒 Secrets: Placeholders créés"

echo -e "\n✅ Infrastructure GCP de base créée avec succès !"