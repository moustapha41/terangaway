"""Mesure, sur les captures, l'étendue de la fenêtre modale (bureau) ou le haut de la feuille (téléphone)."""
import json, sys
from PIL import Image
fmt = sys.argv[1]; D = f"ressources/{fmt}"
m = json.load(open(f"{D}/manifeste.json")); dpr = m["dpr"]; r = m["rects"]
def blanc(im, x, y): return min(im.getpixel((x, y))[:3]) >= 246
out = {}
for k, nom in (("e", "popup"), ("f", "oui")):
    im = Image.open(f"{D}/{nom}-0.jpg").convert("RGB")
    if fmt == "desktop":
        x = int((r["oui"]["x"] - 8) * dpr); cy = int(im.size[1] / 2)
        a = cy
        while a > 0 and blanc(im, x, a - 1): a -= 1
        b = cy
        while b < im.size[1] - 1 and blanc(im, x, b + 1): b += 1
        out[k] = [a / dpr, b / dpr]
    else:
        x = int(40 * dpr); h = im.size[1]; res = None
        for y in range(int(60 * dpr), h - 80):
            if all(blanc(im, x, y + j) for j in range(0, 40)): res = y / dpr; break
        out[k] = res
json.dump(out, open(f"{D}/mesures.json", "w")); print(fmt, out)
