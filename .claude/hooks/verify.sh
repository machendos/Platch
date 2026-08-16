#!/usr/bin/env bash
# Runs `npm run verify` for whichever package has uncommitted changes, and
# reports failures back to Claude by exiting 2 with the output on stderr.
set -uo pipefail

input=$(cat)

# Claude Code re-runs Stop hooks after it responds to one. Without this guard a
# failure that Claude cannot fix would loop forever.
case "$input" in
*'"stop_hook_active"'*[Tt]rue*) exit 0 ;;
esac

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

failures=""

for pkg in mobile backend; do
  [ -n "$(git status --porcelain -- "$pkg")" ] || continue

  if ! out=$(cd "$pkg" && npm run verify 2>&1); then
    failures="${failures}
=== ${pkg}: npm run verify failed ===
$(printf '%s' "$out" | tail -40)
"
  fi
done

[ -z "$failures" ] && exit 0

printf '%s\n' "$failures" >&2
exit 2
