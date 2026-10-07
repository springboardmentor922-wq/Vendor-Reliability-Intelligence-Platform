#!/bin/bash
# Helper script to push the Vendor Reliability Intelligence Platform to GitHub
# Usage: ./push-to-github.sh <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>

set -e

REPO_URL="github.com/springboardmentor922-wq/Vendor-Reliability-Intelligence-Platform.git"
BRANCH="Abijin-Suvedha-A-Vendor-Reliability-Intelligence-Platform"

if [ -z "$1" ]; then
  echo "Usage: ./push-to-github.sh <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo "Or run manually:"
  echo "  git remote add origin https://<YOUR_GITHUB_TOKEN>@$REPO_URL"
  echo "  git push -u origin $BRANCH"
  exit 1
fi

TOKEN="$1"

echo "Configuring remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${TOKEN}@${REPO_URL}"

echo "Pushing branch $BRANCH to GitHub..."
git push -u origin "$BRANCH"

# Remove token from remote config for security
git remote set-url origin "https://${REPO_URL}"

echo "Successfully pushed to https://github.com/springboardmentor922-wq/Vendor-Reliability-Intelligence-Platform/tree/$BRANCH"
