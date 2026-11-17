"""Estágio 4: locais de votação (lat/lon, bairro) + votos de Presidente por local."""
import json, sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

(OUT / "locais").mkdir(exist_ok=True)
t2i = {int(k): v for k, v in json.load(open(CACHE / "tse2ibge.json")).items()}
ents = {t: json.load(open(OUT / f"res_pres{t}.json", encoding="utf-8"))["ents"] for t in (1, 2)}
nrs = {t: [e["nr"] for e in ents[t]] for t in (1, 2)}

# ---- 1) votos por (turno, UF, mun, zona, local, votavel)
print("votos por seção (Presidente)...")
acc = []
with zopen("votacao_secao_2026_BR.zip", "votacao_secao_2026_BR.csv") as f:
    for i, ch in enumerate(pd.read_csv(f, sep=";", encoding="latin-1", chunksize=3_000_000,
                                       usecols=["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_VOTAVEL",
                                                "QT_VOTOS", "NR_LOCAL_VOTACAO"],
                                       dtype={"CD_MUNICIPIO": int, "NR_ZONA": int, "NR_VOTAVEL": int,
                                              "NR_LOCAL_VOTACAO": int, "QT_VOTOS": int})):
        ch = ch[ch.SG_UF != "ZZ"]
        acc.append(ch.groupby(["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO", "NR_VOTAVEL"],
                              as_index=False).QT_VOTOS.sum())
        print("  chunk", i, len(ch))
V = pd.concat(acc).groupby(["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO", "NR_VOTAVEL"],
                           as_index=False).QT_VOTOS.sum()
print("linhas votos agregados:", len(V))

# ---- 2) cadastro dos locais
print("locais...")
cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO",
        "NM_BAIRRO", "DS_ENDERECO", "NR_LATITUDE", "NR_LONGITUDE", "QT_ELEITOR_ELEICAO_FEDERAL"]
L = []
for u in UFS:
    with zopen("eleitorado_local_votacao_2026.zip", f"eleitorado_local_votacao_2026_{u}.csv") as f:
        d = pd.read_csv(f, sep=";", encoding="latin-1", usecols=cols,
                        dtype={"CD_MUNICIPIO": int, "NR_ZONA": int, "NR_LOCAL_VOTACAO": int,
                               "NR_LATITUDE": str, "NR_LONGITUDE": str})
    d["lat"] = pd.to_numeric(d.NR_LATITUDE.str.replace(",", "."), errors="coerce")
    d["lon"] = pd.to_numeric(d.NR_LONGITUDE.str.replace(",", "."), errors="coerce")
    L.append(d)
L = pd.concat(L, ignore_index=True)
ok = L.lat.between(-34.5, 5.5) & L.lon.between(-74.5, -28) & (L.lat != 0)
L.loc[~ok, ["lat", "lon"]] = np.nan
print("seções:", len(L), " sem coordenada:", int((~ok).sum()))
key = ["SG_UF", "CD_MUNICIPIO", "NR_ZONA", "NR_LOCAL_VOTACAO"]
L1 = L[L.NR_TURNO == 1]
loc = L1.groupby(key).agg(nome=("NM_LOCAL_VOTACAO", "first"), bairro=("NM_BAIRRO", "first"),
                          end=("DS_ENDERECO", "first"), lat=("lat", "median"), lon=("lon", "median"),
                          elei=("QT_ELEITOR_ELEICAO_FEDERAL", "sum"), secoes=("NR_SECAO", "nunique")).reset_index()
# locais que só existem no 2º turno
L2 = L[(L.NR_TURNO == 2)]
loc2 = L2.groupby(key).agg(nome=("NM_LOCAL_VOTACAO", "first"), bairro=("NM_BAIRRO", "first"),
                           end=("DS_ENDERECO", "first"), lat=("lat", "median"), lon=("lon", "median"),
                           elei=("QT_ELEITOR_ELEICAO_FEDERAL", "sum"), secoes=("NR_SECAO", "nunique")).reset_index()
loc = pd.concat([loc, loc2.merge(loc[key], on=key, how="left", indicator=True).query("_merge=='left_only'").drop(columns="_merge")],
                ignore_index=True)
print("locais:", len(loc))

# ---- 3) montar vetores de votos por local
sel = {}
for t in (1, 2):
    v = V[V.NR_TURNO == t]
    wide = v.pivot_table(index=key, columns="NR_VOTAVEL", values="QT_VOTOS", aggfunc="sum", fill_value=0)
    order = nrs[t] + [95, 96]
    for c in order:
        if c not in wide.columns:
            wide[c] = 0
    sel[t] = wide[order]
    print(f"turno {t}: locais com voto:", len(wide))
loc = loc.set_index(key)
loc["has1"] = loc.index.isin(sel[1].index)
loc["has2"] = loc.index.isin(sel[2].index)
print("locais sem voto T1:", int((~loc.has1).sum()), " T2:", int((~loc.has2).sum()))

tot_votes = 0
for u in UFS:
    sub = loc.loc[u] if u in loc.index.get_level_values(0) else None
    if sub is None:
        continue
    rows = []
    s1 = sel[1].loc[u] if u in sel[1].index.get_level_values(0) else None
    s2 = sel[2].loc[u] if u in sel[2].index.get_level_values(0) else None
    for (mun, zona, lv), r in sub.iterrows():
        ib = t2i.get(int(mun))
        if ib is None:
            continue
        v1 = s1.loc[(mun, zona, lv)].astype(int).tolist() if (s1 is not None and r.has1) else None
        v2 = s2.loc[(mun, zona, lv)].astype(int).tolist() if (s2 is not None and r.has2) else None
        if v1 is None and v2 is None:
            continue
        rows.append([ib, int(zona), int(lv), r.nome, r.bairro if isinstance(r.bairro, str) else "",
                     r.end if isinstance(r.end, str) else "",
                     int(r.elei), int(r.secoes),
                     None if np.isnan(r.lon) else round(float(r.lon), 5),
                     None if np.isnan(r.lat) else round(float(r.lat), 5), v1, v2])
    tot_votes += len(rows)
    jdump({"uf": u, "rows": rows}, OUT / "locais" / f"{u}.json")
print("total de locais exportados:", tot_votes)
