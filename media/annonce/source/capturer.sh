#!/bin/bash
# Capture une image du film paysage. $1 = numéro d'image, $2 = fps
#
# Chaque image lance un navigateur. Deux précautions, apprises à nos dépens :
#   — `timeout` : un navigateur qui se bloque est tué au lieu de s'accumuler.
#     Sans cela, 62 processus d'un rendu précédent se partageaient encore le
#     processeur pendant le suivant.
#   — un profil jetable par appel, supprimé ensuite, pour qu'ils ne se gênent pas.
set -u
S="$(cd "$(dirname "$0")" && pwd)"
T=$(python3 -c "print(f'{$1/$2:.4f}')")
B=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
PROFIL=$(mktemp -d -t teranga-capture-XXXXXX)
trap 'rm -rf "$PROFIL"' EXIT

timeout 40 "$B" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFIL" \
  --force-device-scale-factor=1 --window-size=1280,720 --virtual-time-budget=3000 \
  --screenshot="$S/../images-16x9/$(printf '%04d' "$1").png" \
  "file://$S/film.html?t=$T" 2>/dev/null
