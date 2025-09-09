#!/bin/bash

set -e

TEMPLATE_DIR="packages/lib-service-template"
APPS_DIR="apps"

echo "Generating service skeletons..."

# Function to generate service
generate_service() {
    local SERVICE_DIR=$1
    local SERVICE_DESCRIPTION=$2
    local SERVICE_NAME="@hyperush/$SERVICE_DIR"
    local SERVICE_PATH="$APPS_DIR/$SERVICE_DIR"
    
    echo "Creating $SERVICE_NAME..."
    
    # Create service directory
    mkdir -p "$SERVICE_PATH/src"
    
    # Copy and customize package.json
    sed -e "s|SERVICE_NAME|$SERVICE_NAME|g" -e "s|SERVICE_DESCRIPTION|$SERVICE_DESCRIPTION|g" \
        "$TEMPLATE_DIR/package.json" > "$SERVICE_PATH/package.json"
    
    # Copy and customize main source file
    sed "s|SERVICE_NAME|$SERVICE_DIR|g" \
        "$TEMPLATE_DIR/index.ts" > "$SERVICE_PATH/src/index.ts"
    
    # Copy other config files
    cp "$TEMPLATE_DIR/tsconfig.json" "$SERVICE_PATH/"
    cp "$TEMPLATE_DIR/tsup.config.ts" "$SERVICE_PATH/"
    cp "$TEMPLATE_DIR/vitest.config.ts" "$SERVICE_PATH/"
    
    # Copy and customize README
    sed -e "s|SERVICE_NAME|$SERVICE_DIR|g" -e "s|SERVICE_DESCRIPTION|$SERVICE_DESCRIPTION|g" \
        "$TEMPLATE_DIR/README.md" > "$SERVICE_PATH/README.md"
        
    echo "✓ Created $SERVICE_NAME"
}

# Generate all services
generate_service "svc-shops" "Shop management and configuration service"
generate_service "svc-requests" "Request processing and workflow management service"
generate_service "svc-preview" "Document preview and rendering service"
generate_service "svc-ia-diff" "AI-powered document comparison service"
generate_service "svc-quality" "Quality assessment and verification service"
generate_service "svc-billing" "Billing and subscription management service"
generate_service "svc-notify" "Notification delivery service"
generate_service "svc-admin" "Administrative operations service"
generate_service "api-gateway" "API Gateway and routing service"

echo "All services generated successfully!"