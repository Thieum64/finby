#!/bin/bash

# Terraform imports for existing resources
# Phase 0 - Fondations & IaC
# Date: 2025-09-11

set -e

PROJECT_ID="hyperush-dev"
TF_DIR="infra/terraform/environments/dev"

echo "🔄 Starting Terraform imports for existing resources..."

cd "$TF_DIR"

# 1. Firestore Database
echo "📊 Importing Firestore database..."
terraform import google_firestore_database.database "projects/${PROJECT_ID}/databases/(default)" || echo "⚠️ Firestore already imported or doesn't exist"

# 2. Pub/Sub Topics and Subscriptions
echo "🔔 Importing Pub/Sub topics..."
terraform import module.pubsub.google_pubsub_topic.jobs "projects/${PROJECT_ID}/topics/jobs" || echo "⚠️ Topic jobs already imported or doesn't exist"
terraform import module.pubsub.google_pubsub_topic.requests "projects/${PROJECT_ID}/topics/requests" || echo "⚠️ Topic requests already imported or doesn't exist"  
terraform import module.pubsub.google_pubsub_topic.notifications "projects/${PROJECT_ID}/topics/notifications" || echo "⚠️ Topic notifications already imported or doesn't exist"
terraform import module.pubsub.google_pubsub_topic.dlq "projects/${PROJECT_ID}/topics/dead-letter-queue" || echo "⚠️ Topic dead-letter-queue already imported or doesn't exist"

echo "🔔 Importing Pub/Sub subscriptions..."
terraform import module.pubsub.google_pubsub_subscription.jobs_sub "projects/${PROJECT_ID}/subscriptions/jobs-sub" || echo "⚠️ Subscription jobs-sub already imported or doesn't exist"
terraform import module.pubsub.google_pubsub_subscription.requests_sub "projects/${PROJECT_ID}/subscriptions/requests-sub" || echo "⚠️ Subscription requests-sub already imported or doesn't exist"
terraform import module.pubsub.google_pubsub_subscription.notifications_sub "projects/${PROJECT_ID}/subscriptions/notifications-sub" || echo "⚠️ Subscription notifications-sub already imported or doesn't exist"
terraform import module.pubsub.google_pubsub_subscription.dlq_sub "projects/${PROJECT_ID}/subscriptions/dlq-sub" || echo "⚠️ Subscription dlq-sub already imported or doesn't exist"

# 3. Secret Manager secrets
echo "🔐 Importing Secret Manager secrets..."
terraform import module.secrets.google_secret_manager_secret.firebase_sa_json "projects/${PROJECT_ID}/secrets/firebase-service-account-json" || echo "⚠️ Secret firebase-service-account-json already imported or doesn't exist"
terraform import module.secrets.google_secret_manager_secret.stripe_secret "projects/${PROJECT_ID}/secrets/stripe-api-secret" || echo "⚠️ Secret stripe-api-secret already imported or doesn't exist"
terraform import module.secrets.google_secret_manager_secret.shopify_webhook_secret "projects/${PROJECT_ID}/secrets/shopify-webhook-secret" || echo "⚠️ Secret shopify-webhook-secret already imported or doesn't exist"

# 4. Logging metrics and sinks (if they exist)
echo "📊 Importing logging metrics..."
terraform import module.logging.google_logging_metric.job_failed_count "projects/${PROJECT_ID}/metrics/hyperush_job_failed_count" || echo "⚠️ Metric job_failed_count already imported or doesn't exist"
terraform import module.logging.google_logging_metric.request_count "projects/${PROJECT_ID}/metrics/hyperush_request_count" || echo "⚠️ Metric request_count already imported or doesn't exist"

echo "📊 Importing logging sinks..."
terraform import module.logging.google_logging_project_sink.error_sink "projects/${PROJECT_ID}/sinks/hyperush-error-sink" || echo "⚠️ Sink error_sink already imported or doesn't exist"

echo "✅ Terraform imports completed!"
echo "🔍 Running terraform plan to check for diffs..."

terraform plan

echo "📋 Import script completed."