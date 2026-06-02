#!/usr/bin/env bash
# Run in Google Cloud Shell from repo root: bash scripts/cloudshell-deploy.sh
set -euo pipefail

echo "==> Node version (need 18+)"
if command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi
node -v
npm -v

echo "==> Enable APIs for Firebase Hosting + Frameworks"
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  --project=familytree-70db5

echo "==> Firebase CLI"
firebase experiments:enable webframeworks
firebase use familytree-70db5

if [[ ! -f .env.local ]]; then
  echo "ERROR: Create .env.local first (see docs/CLOUDSHELL-DEPLOY.md)"
  exit 1
fi

echo "==> Install and deploy"
npm ci
firebase deploy --only hosting --project familytree-70db5

echo ""
echo "Done. App URL: https://familytree-70db5.web.app"
