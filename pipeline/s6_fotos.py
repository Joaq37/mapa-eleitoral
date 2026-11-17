"""Estágio 6: extrai as fotos dos candidatos (TSE) para site/fotos/<SQ_CANDIDATO>.jpg."""
import re, sys, zipfile
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

src = ROOT / "dados" / "fotos_2026"
dst = ROOT / "site" / "fotos"
dst.mkdir(parents=True, exist_ok=True)
n = 0
for z in sorted(src.glob("foto_cand2026_*_div.zip")):
    with zipfile.ZipFile(z) as zf:
        for info in zf.infolist():
            m = re.match(r"^F[A-Z]{2}(\d+)_div\.jpg$", info.filename)
            if not m:
                continue
            (dst / f"{m.group(1)}.jpg").write_bytes(zf.read(info))
            n += 1
print("fotos extraídas:", n)
