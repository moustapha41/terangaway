#!/bin/bash
# Capture une image du film. $1 = numéro d'image, $2 = fps
S="$(dirname "$0")"
N=$1; FPS=$2
T=$(python3 -c "print(f'{$N/$FPS:.4f}')")
B=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
"$B" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1280,720 \
  --virtual-time-budget=2500 \
  --screenshot="$S/images/$(printf '%04d' $N).png" \
  "file://$S/scene.html?t=$T" 2>/dev/null
