#!/usr/bin/env bash
# Pull latest from GitHub — makes GitHub the source of truth
set -e

if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT secret is not set. Add it in Replit Secrets."
  exit 1
fi

REPO="https://$GITHUB_PAT@github.com/Babyboy619/Kamzybotsmedia.git"

# Clear stale locks
find .git -name "*.lock" -delete 2>/dev/null || true

git config user.email "kamzybotsmedia@replit.dev"
git config user.name "KAMZYBOT'S MEDIA Bot"
git config pull.rebase false

git remote set-url origin "$REPO"

echo "⬇️  Pulling latest from GitHub (main)..."
git pull origin main --allow-unrelated-histories --no-edit
echo "✅ Replit is now in sync with GitHub."
