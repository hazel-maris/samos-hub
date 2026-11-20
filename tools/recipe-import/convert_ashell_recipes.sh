#!/bin/sh
# SamOS on a-Shell: run the verified lg2 shell command, then only changed recipes.
# Local utility; never commits, pushes, resets, or writes to Supabase.
set -e
BASE="$HOME/Documents"
FULL=0
PULL=1
for option in "$@"; do
  case "$option" in
    --full) FULL=1 ;;
    --no-pull) PULL=0 ;;
    *) echo "Unknown option: $option (use --full or --no-pull)" >&2; exit 2 ;;
  esac
done
if [ ! -d "$BASE/SamOS.git/.git" ]; then
  echo "Cannot find private SamOS checkout in $BASE/SamOS.git" >&2
  exit 2
fi
if [ "$PULL" -eq 1 ]; then
  echo "Pulling the private SamOS vault..."
  if ! (cd "$BASE/SamOS.git" && lg2 pull); then
    echo "Pull failed. No conversion started and no Git reset performed." >&2
    exit 1
  fi
fi
if [ "$FULL" -eq 1 ]; then
  exec python3 "$BASE/samos-hub.git/tools/recipe-import/convert_incremental.py" \
    "$BASE/SamOS.git/community-center/food-room/recipe-book/recipes" \
    --converter "$BASE/samos-hub.git/tools/recipe-import/convert_recipes.py" \
    --out "$BASE/recipe-conversion-preview" --full
fi
exec python3 "$BASE/samos-hub.git/tools/recipe-import/convert_incremental.py" \
  "$BASE/SamOS.git/community-center/food-room/recipe-book/recipes" \
  --converter "$BASE/samos-hub.git/tools/recipe-import/convert_recipes.py" \
  --out "$BASE/recipe-conversion-preview"
