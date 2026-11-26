#!/usr/bin/env bash
# Stop hook: run `npm run check` before the agent hands back.
# Skips when nothing changed since the last passing run. Exit 2 sends the
# failure back to the agent so it fixes it; a second failure in a row lets
# it stop (stop_hook_active) so it reports instead of looping.
set -uo pipefail
cd "$CLAUDE_PROJECT_DIR" || exit 0
active=$(jq -r '.stop_hook_active // false' 2>/dev/null)
state=$({ git diff HEAD --binary; git ls-files --others --exclude-standard -z | xargs -0 cat 2>/dev/null; } | shasum | cut -d' ' -f1)
stamp="$(git rev-parse --git-dir)/inkwell-check-ok"
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$state" ] && exit 0
if out=$(npm run check 2>&1); then echo "$state" > "$stamp"; exit 0; fi
[ "$active" = "true" ] && { echo "npm run check still fails; tell the user." >&2; exit 0; }
{ echo "npm run check failed. Fix it before finishing:"; printf '%s\n' "$out" | tail -40; } >&2
exit 2
