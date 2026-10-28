"""Prépare les photos d'une annonce : orientation appliquée, 1600 px au plus, sans métadonnées (l'EXIF porte volontiers la position GPS).

    python3 photos.py <dossier-source> <slug> <n,n,n…>      (n = rang de la photo dans l'ordre alphabétique, à partir de 1)
"""
import sys, glob, os
from PIL import Image, ImageOps

src, slug, rangs = sys.argv[1], sys.argv[2], [int(n) for n in sys.argv[3].split(",")]
fichiers = sorted(glob.glob(os.path.join(src, "*.jpeg")))
sortie = os.path.join("apps/web/public/images/logements", slug)
os.makedirs(sortie, exist_ok=True)
for n in rangs:
    im = ImageOps.exif_transpose(Image.open(fichiers[n - 1])).convert("RGB")
    im.thumbnail((1600, 1600), Image.LANCZOS)
    im.save(os.path.join(sortie, f"{n:02d}.jpg"), "JPEG", quality=84, optimize=True, progressive=True)  # sans exif=
print(slug, len(rangs), "photos")
