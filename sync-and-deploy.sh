#!/usr/bin/env bash
# Sync the games from their build folders into this repo and publish.
#
# Source of truth is /Users/sharon.gao/Downloads/claude-code-test-<game>/.
# Edit there, then run this. It mirrors the runnable files in, shows what
# changed, commits, and pushes — GitHub Pages redeploys in about a minute.
#
#   ./sync-and-deploy.sh                      # sync all five, auto commit message
#   ./sync-and-deploy.sh -m "faster bird"     # sync all five, your message
#   ./sync-and-deploy.sh tiny-wings           # sync one game only
#   ./sync-and-deploy.sh --dry-run            # show what would change, touch nothing

set -euo pipefail
cd "$(dirname "$0")"

SRC_ROOT="/Users/sharon.gao/Downloads"
ALL=(tiny-wings motherload thronefall slither-io merge-dragons)
MSG=""
DRY=0
GAMES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) GAMES+=("$1"); shift ;;
  esac
done
[[ ${#GAMES[@]} -eq 0 ]] && GAMES=("${ALL[@]}")

# Everything the game needs to run, minus the build-time clutter.
EXCLUDES=(
  --exclude 'screenshots' --exclude 'screenshots-orch*' --exclude 'shots' --exclude 'shots-*'
  --exclude 'final-verify' --exclude 'node_modules' --exclude '.git' --exclude 'BENCHMARK.md'
  --exclude '.DS_Store'
)

RSYNC_FLAGS=(-a --delete)
[[ $DRY -eq 1 ]] && RSYNC_FLAGS+=(--dry-run)

echo "Syncing: ${GAMES[*]}"
for g in "${GAMES[@]}"; do
  src="$SRC_ROOT/claude-code-test-$g"
  if [[ ! -d "$src" ]]; then echo "  !! no such build folder: $src" >&2; exit 1; fi
  if [[ ! -f "$src/index.html" ]]; then echo "  !! $g has no index.html, refusing" >&2; exit 1; fi
  out=$(rsync "${RSYNC_FLAGS[@]}" "${EXCLUDES[@]}" -i "$src/" "./$g/" | grep -v '^\./$' || true)
  n=$(printf '%s' "$out" | grep -c . || true)
  printf "  %-15s %s file(s) changed\n" "$g" "${n:-0}"
done

if [[ $DRY -eq 1 ]]; then
  echo ""
  echo "Dry run — nothing written, nothing pushed."
  exit 0
fi

if git diff --quiet && git diff --cached --quiet && [[ -z "$(git status --porcelain)" ]]; then
  echo ""
  echo "No changes to publish. Already up to date."
  exit 0
fi

echo ""
git -c color.ui=always status --short | head -30
CHANGED=$(git status --porcelain | wc -l | tr -d ' ')
echo "($CHANGED path(s) changed)"

if [[ -z "$MSG" ]]; then
  MSG="Update $(IFS=', '; echo "${GAMES[*]}")"
fi

git add -A
git -c user.email=sharon.gao@unity3d.com -c user.name="Sharon Gao" commit -q -m "$MSG

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -q origin HEAD
echo ""
echo "Pushed: $(git rev-parse --short HEAD) — $MSG"
echo "Live in ~1 min: https://sharonshobbies.github.io/five-games-no-engine/"
