#!/bin/bash

# Optional: Check for unstaged changes
if ! git diff-index --quiet HEAD --; then
  echo "🔧 Staging and committing changes..."
  git add .
  git commit -m "Deploy: Sync local changes before Netlify deploy"
else
  echo "✅ No unstaged changes found. Proceeding..."
fi

echo "🚀 Deploying to Netlify (production)..."
npx netlify deploy --prod

if [ $? -eq 0 ]; then
  echo "✅ Netlify deploy successful. Pushing to GitHub..."
  git push
else
  echo "❌ Netlify deploy failed. Not pushing to GitHub."
fi
