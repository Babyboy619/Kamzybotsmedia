#!/usr/bin/env bash
# Auto-push to GitHub — Replit is source of truth, force-pushes to main
set -e

if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT secret is not set. Add it in Replit Secrets."
  exit 1
fi

REPO="https://$GITHUB_PAT@github.com/Babyboy619/Kamzybotsmedia.git"

# Clear any stale git lock files and abort any in-progress merge
find .git -name "*.lock" -delete 2>/dev/null || true
rm -f .git/MERGE_HEAD .git/MERGE_MSG .git/MERGE_MODE 2>/dev/null || true

# Configure identity for this session
git config user.email "kamzybotsmedia@replit.dev"
git config user.name "KAMZYBOT'S MEDIA Bot"

# Set authenticated remote
git remote set-url origin "$REPO"

# Stop tracking attached_assets/ (already in .gitignore)
git rm -r --cached attached_assets/ 2>/dev/null || true

# Stage everything
git add -A

# Commit only if there are staged changes
if git diff --cached --quiet; then
  echo "✅ Nothing new to commit."
else
  git commit -m "chore: sync from Replit [$(date '+%Y-%m-%d %H:%M')]"
  echo "📦 Changes committed."
fi

# Force-push: Replit is always the source of truth
git push origin HEAD:main --force
echo "🚀 Successfully pushed to github.com/Babyboy619/Kamzybotsmedia (main)"
