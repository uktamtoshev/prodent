#!/usr/bin/env bash
# ============================================================
#  PRODENT — Auto-push helper
#  Usage:
#    ./ops/push-to-github.sh "commit message"
#  Or pass no args → an auto-message based on changed paths.
#
#  Behaviour:
#    1. git add -A
#    2. git commit (skipped if there is nothing staged)
#    3. git push -u origin <current-branch>
#  Auth: relies on Git Credential Manager already being set up.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Auto-detect or accept a commit message --------------------
MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  # Build a one-line summary of the most-touched directories
  SCOPE=$(git status --short \
            | awk '{print $2}' \
            | awk -F/ '{print $1"/"$2}' \
            | sort -u \
            | head -3 \
            | tr '\n' ',' \
            | sed 's/,$//')
  MSG="chore: incremental updates (${SCOPE:-misc})"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "→ Branch: $BRANCH"
echo "→ Message: $MSG"

# --- Stage -----------------------------------------------------
git add -A

# --- Commit (skip if nothing staged) ---------------------------
if git diff --cached --quiet; then
  echo "→ Nothing to commit, skipping."
else
  git commit -m "$MSG

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
fi

# --- Push ------------------------------------------------------
echo "→ Pushing to origin/$BRANCH..."
GIT_TERMINAL_PROMPT=0 git push -u origin "$BRANCH"

echo ""
echo "✓ Done."
echo "  PR: https://github.com/uktamtoshev/prodent/pull/new/$BRANCH"
