#!/bin/bash
set -euo pipefail

# Configuration
PROJECT_ID="hyperush-dev"
REGION="europe-west1"
FIRESTORE_LOCATION="eur3"
BILLING_ID="<ton_billing_id_GCP>"

echo "🚀 Configuration de Google Cloud SDK..."

# Login to GCP
echo "🔐 Connexion à Google Cloud (ouverture du navigateur)..."
gcloud auth login

# Set project
echo "📂 Configuration du projet: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "${REGION}-a"

# Create project if it doesn't exist
if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "🆕 Création du projet GCP: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="Hyperush Dev Environment"
    
    # Link billing account
    echo "💳 Association du compte de facturation..."
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ID"
else
    echo "✅ Projet $PROJECT_ID existe déjà"
fi

# Enable required APIs
echo "🔌 Activation des APIs GCP nécessaires..."
apis=(
    "cloudbuild.googleapis.com"
    "run.googleapis.com"
    "artifactregistry.googleapis.com"
    "pubsub.googleapis.com"
    "secretmanager.googleapis.com"
    "firestore.googleapis.com"
    "firebase.googleapis.com"
    "logging.googleapis.com"
    "monitoring.googleapis.com"
    "cloudtrace.googleapis.com"
    "iamcredentials.googleapis.com"
    "cloudresourcemanager.googleapis.com"
)

for api in "${apis[@]}"; do
    echo "⚡ Activation de $api..."
    gcloud services enable "$api"
done

# Verify authentication and configuration
echo -e "\n🔍 Vérification de la configuration:"
echo "Compte actuel: $(gcloud config get-value account)"
echo "Projet: $(gcloud config get-value project)"
echo "Région: $(gcloud config get-value compute/region)"

# Application Default Credentials for local development
echo "🔑 Configuration des Application Default Credentials..."
gcloud auth application-default login

echo -e "\n✅ Configuration Google Cloud terminée !"
echo "💡 Projet: $PROJECT_ID"
echo "💡 Région: $REGION"