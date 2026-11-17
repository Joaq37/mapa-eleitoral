"""Sonda: mostra o layout (arquivos e cabeçalhos) dos resultados do TSE de anos antigos. Roda no GitHub Actions."""
import os, sys, urllib.request, zipfile
from pathlib import Path
CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"
tmp = Path(os.environ.get("DATA_DIR", "."))
tmp.mkdir(parents=True, exist_ok=True)
for y in [int(a) for a in sys.argv[1:]]:
    for kind in ("votacao_candidato_munzona", "detalhe_votacao_munzona"):
        z = tmp / f"{kind}_{y}.zip"
        if not z.exists():
            urllib.request.urlretrieve(f"{CDN}/{kind}/{kind}_{y}.zip", z)
        zf = zipfile.ZipFile(z)
        names = zf.namelist()
        print(f"##### {y} {kind}: {len(names)} arquivos, {z.stat().st_size/1e6:.0f} MB; exemplos: {names[:5]}")
        pick = [n for n in names if n.lower().endswith((".csv", ".txt")) and ("_BR." in n or "BRASIL" in n)] or [n for n in names if n.lower().endswith((".csv", ".txt"))]
        for n in pick[:2]:
            with zf.open(n) as f:
                for i in range(2):
                    print(f"   [{n}] linha {i}:", f.readline().decode("latin-1").rstrip()[:900])
        z.unlink()
