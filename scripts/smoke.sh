#!/usr/bin/env bash
# Smoke test - validate container starts and responds to /healthz
set -euo pipefail

IMG="${1:-}"
if [ -z "$IMG" ]; then
  echo "Usage: $0 <image>"
  exit 1
fi

CID=""
trap cleanup EXIT

cleanup() {
  if [ -n "${CID:-}" ]; then
    echo "=== Container logs ==="
    docker logs "$CID" 2>&1 | tail -50 || true
    docker rm -f "$CID" >/dev/null 2>&1 || true
  fi
}

echo "🔍 Smoke testing: $IMG"
CID=$(docker run -d -e PORT=8080 -e NODE_ENV=production -e ENABLE_OTEL=false -p 18080:8080 "$IMG")
echo "✓ Container started: $CID"

echo "⏳ Waiting 8s for service to start..."
sleep 8

echo "🏥 Health check GET http://127.0.0.1:18080/healthz"
if curl -fsS --max-time 5 http://127.0.0.1:18080/healthz >/dev/null 2>&1; then
  echo "✅ SMOKE_OK - Service responding"
  exit 0
else
  echo "❌ SMOKE_FAIL - Health check failed"
  exit 1
fi
