#!/bin/bash
# Capture une image du film vertical. $1 = numéro, $2 = fps, $3 = format (9x16 | 1x1)
# Mêmes précautions que la version paysage : voir capturer.sh.
set -u
S="$(cd "$(dirname "$0")" && pwd)"
T=$(python3 -c "print(f'{$1/$2:.4f}')")
case "$3" in
  1x1) DIM="1080,1080" ;;
  *)   DIM="1080,1920" ;;
esac
B=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
PROFIL=$(mktemp -d -t teranga-capture-XXXXXX)
trap 'rm -rf "$PROFIL"' EXIT

timeout 40 "$B" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFIL" \
  --force-device-scale-factor=1 --window-size="$DIM" --virtual-time-budget=3500 \
  --screenshot="$S/../images-$3/$(printf '%04d' "$1").png" \
  "file://$S/film-vertical.html?format=$3&t=$T" 2>/dev/null
