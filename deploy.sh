#!/bin/sh
# One command to refresh the hosted copy: rebuild insight tables + data + workbook, then upload to Railway.
# The parent repo's .gitignore hides data/dist, so --no-gitignore is required; .railwayignore keeps private files out.
set -e
cd "$(dirname "$0")"
node scripts/extras-build.mjs >/dev/null 2>&1 || true
npm run build --silent
node scripts/extras-build.mjs >/dev/null 2>&1 || true
npm run build --silent | tail -1
railway up --service portal --detach --no-gitignore | grep -i "deployment:" || true
echo "Live in about a minute: https://portal-production-f9184d2a.up.railway.app"
