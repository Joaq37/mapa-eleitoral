"""Estágio 1: malhas IBGE + tabela de correspondência TSE <-> IBGE."""
import json, sys
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

# --- municípios IBGE
mun = json.load(open(GEO / "municipios.json", encoding="utf-8"))
ibge = {}
for m in mun:
    try:
        uf = m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
    except Exception:
        uf = m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]
    ibge[str(m["id"])] = (uf, m["nome"])
print("IBGE municípios:", len(ibge))

# --- municípios TSE (a partir do detalhe da apuração)
rows = []
with zopen("detalhe_votacao_munzona_2026.zip", "detalhe_votacao_munzona_2026_BRASIL.csv") as f:
    df = pd.read_csv(f, sep=";", encoding="latin-1", usecols=["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO"], dtype=str)
tse = df.drop_duplicates().reset_index(drop=True)
tse = tse[tse.SG_UF != "ZZ"]
print("TSE municípios:", len(tse))

by_name = {(uf, norm(n)): c for c, (uf, n) in ibge.items()}
match, un = {}, []
for r in tse.itertuples():
    c = by_name.get((r.SG_UF, norm(r.NM_MUNICIPIO)))
    if c:
        match[r.CD_MUNICIPIO] = c
    else:
        un.append((r.SG_UF, r.CD_MUNICIPIO, r.NM_MUNICIPIO))
print("casados por nome:", len(match), "sem par:", len(un))
used = set(match.values())
free = {c: v for c, v in ibge.items() if c not in used}
print("IBGE sem par:", len(free))
MANUAL = {"71013": "3550001", "53031": "3165206", "92690": "5203500", "91553": "5107800",
          "77119": "4116307", "03158": "1400605", "41092": "3105509", "17035": "2405306",
          "44571": "3122900", "31011": "2800100", "00337": "1100346", "00256": "1100098",
          "04120": "1502954"}
for k, v in MANUAL.items():
    match[k] = v
assert len(match) == len(tse) == len(set(match.values())), (len(match), len(tse))

# --- tabela mestre de municípios (ordem fixa = índice usado pelo front)
tse_nome = {r.CD_MUNICIPIO: r.NM_MUNICIPIO for r in tse.itertuples()}
rev = {v: k for k, v in match.items()}
order = sorted(match.values(), key=lambda c: (ibge[c][0], ibge[c][1]))
muns = []
for c in order:
    t = rev[c]
    muns.append([int(c), int(t), ibge[c][1], ibge[c][0]])
jdump(muns, OUT / "muns.json")
json.dump({str(int(t)): int(c) for t, c in match.items()}, open(CACHE / "tse2ibge.json", "w"))

# --- geometrias (coordenadas quantizadas a 4 casas)
def q(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 4), round(coords[1], 4)]
    return [q(c) for c in coords]

g = json.load(open(GEO / "mun.geojson", encoding="utf-8"))
feats = []
for f in g["features"]:
    code = f["properties"]["codarea"]
    feats.append({"type": "Feature", "properties": {"c": int(code)},
                  "geometry": {"type": f["geometry"]["type"], "coordinates": q(f["geometry"]["coordinates"])}})
jdump({"type": "FeatureCollection", "features": feats}, OUT / "mun.geojson")
u = json.load(open(GEO / "uf.geojson", encoding="utf-8"))
feats = []
for f in u["features"]:
    sg = UF_COD[int(f["properties"]["codarea"])]
    feats.append({"type": "Feature", "properties": {"uf": sg, "nome": UF_NOME[sg]},
                  "geometry": {"type": f["geometry"]["type"], "coordinates": q(f["geometry"]["coordinates"])}})
jdump({"type": "FeatureCollection", "features": feats}, OUT / "uf.geojson")
print("geo ok:", len(muns), "municípios")
