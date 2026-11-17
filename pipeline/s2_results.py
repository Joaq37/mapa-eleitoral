"""Estágio 2: resultados por município (candidatos/partidos) + comparecimento."""
import json, sys, zipfile
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

t2i = {int(k): v for k, v in json.load(open(CACHE / "tse2ibge.json")).items()}
muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
idx = {m[0]: i for i, m in enumerate(muns)}
CARGOS = {1: "pres", 3: "gov", 5: "sen", 6: "dfed", 7: "dest", 8: "ddist"}
CARGO_NOME = {"pres": "Presidente", "gov": "Governador", "sen": "Senador", "dfed": "Deputado Federal",
              "dest": "Deputado Estadual", "ddist": "Deputado Distrital"}
TOPN = 30

# ---------- detalhe da apuração (comparecimento etc.)
print("detalhe...")
with zopen("detalhe_votacao_munzona_2026.zip", "detalhe_votacao_munzona_2026_BRASIL.csv") as f:
    d = pd.read_csv(f, sep=";", encoding="latin-1", dtype={"CD_MUNICIPIO": int},
                    usecols=["SG_UF", "NR_TURNO", "CD_CARGO", "CD_MUNICIPIO", "NR_ZONA", "ST_VOTO_EM_TRANSITO",
                             "QT_APTOS", "QT_COMPARECIMENTO", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"])
d = d[(d.SG_UF != "ZZ") & d.CD_CARGO.isin(CARGOS)]
print(" linhas:", len(d), " transito:", d.ST_VOTO_EM_TRANSITO.value_counts().to_dict())
det = d.groupby(["CD_CARGO", "NR_TURNO", "CD_MUNICIPIO"], as_index=False)[
    ["QT_APTOS", "QT_COMPARECIMENTO", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]].sum()
det["r"] = det.QT_COMPARECIMENTO / det.QT_APTOS.clip(lower=1)
print(" comparecimento max/mediana:", det.r.max().round(3), det.r.median().round(3))

# ---------- votação nominal por candidato
cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "CD_CARGO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO",
        "SG_PARTIDO", "QT_VOTOS_NOMINAIS_VALIDOS", "DS_SIT_TOT_TURNO"]
parts = []
members = [f"votacao_candidato_munzona_2026_{u}.csv" for u in UFS + ["BR"]]
for mname in members:
    n = 0
    with zopen("votacao_candidato_munzona_2026.zip", mname) as f:
        for ch in pd.read_csv(f, sep=";", encoding="latin-1", usecols=cols, chunksize=1_500_000,
                              dtype={"SQ_CANDIDATO": "int64", "CD_MUNICIPIO": int}):
            ch = ch[(ch.SG_UF != "ZZ") & ch.CD_CARGO.isin(CARGOS)]
            if mname.endswith("_BR.csv"):
                ch = ch[ch.CD_CARGO == 1]
            else:
                ch = ch[ch.CD_CARGO != 1]
            g = ch.groupby(["CD_CARGO", "NR_TURNO", "SG_UF", "CD_MUNICIPIO", "SQ_CANDIDATO", "NR_CANDIDATO",
                            "NM_URNA_CANDIDATO", "SG_PARTIDO", "DS_SIT_TOT_TURNO"],
                           as_index=False, dropna=False)["QT_VOTOS_NOMINAIS_VALIDOS"].sum()
            parts.append(g)
            n += len(ch)
    print(" ", mname, n)
allc = pd.concat(parts, ignore_index=True)
allc = allc.groupby(["CD_CARGO", "NR_TURNO", "SG_UF", "CD_MUNICIPIO", "SQ_CANDIDATO", "NR_CANDIDATO",
                     "NM_URNA_CANDIDATO", "SG_PARTIDO", "DS_SIT_TOT_TURNO"],
                    as_index=False, dropna=False)["QT_VOTOS_NOMINAIS_VALIDOS"].sum()
allc["ibge"] = allc.CD_MUNICIPIO.map(t2i)
print("sem ibge:", allc.ibge.isna().sum())
allc = allc.dropna(subset=["ibge"])
allc["ibge"] = allc.ibge.astype(int)
allc.to_parquet(CACHE / "cand_munis.parquet") if False else None

index = []
cand_index = []
for (cg, tn), df in allc.groupby(["CD_CARGO", "NR_TURNO"]):
    key = f"{CARGOS[cg]}{tn}"
    dd = det[(det.CD_CARGO == cg) & (det.NR_TURNO == tn)].set_index("CD_MUNICIPIO")
    df = df.copy()
    df["eleito"] = df.DS_SIT_TOT_TURNO.fillna("").str.upper().str.startswith("ELEITO")
    cand_tot = df.groupby(["SQ_CANDIDATO"]).agg(
        tot=("QT_VOTOS_NOMINAIS_VALIDOS", "sum"), nm=("NM_URNA_CANDIDATO", "first"), p=("SG_PARTIDO", "first"),
        nr=("NR_CANDIDATO", "first"), uf=("SG_UF", "first"), el=("eleito", "max"))
    ents = []  # entidades exibíveis
    emap = {}
    cand_tot = cand_tot.sort_values("tot", ascending=False)
    if cg in (1, 3, 5):
        keep = cand_tot
        if cg != 1:
            keep = cand_tot.sort_values(["uf", "tot"], ascending=[True, False])
        for sq, r in keep.iterrows():
            emap[("c", sq)] = len(ents)
            ents.append({"k": f"c{sq}", "n": r.nm.title() if r.nm.isupper() else r.nm, "p": r.p, "nr": int(r.nr),
                         "u": None if cg == 1 else r.uf, "t": "c", "tot": int(r.tot), "el": bool(r.el)})
    else:
        pt = df.groupby("SG_PARTIDO").QT_VOTOS_NOMINAIS_VALIDOS.sum().sort_values(ascending=False)
        for p, v in pt.items():
            emap[("p", p)] = len(ents)
            ents.append({"k": f"p{p}", "n": p, "p": p, "nr": None, "u": None, "t": "p", "tot": int(v), "el": False})
        # candidatos de deputado: arquivo separado por UF (carregado sob demanda no front)
        (OUT / "cand").mkdir(exist_ok=True)
        for uf, sub in df.groupby("SG_UF"):
            ct = cand_tot[cand_tot.uf == uf].sort_values("tot", ascending=False)
            cents = [{"k": f"c{sq}", "n": r.nm.title() if r.nm.isupper() else r.nm, "p": r.p, "nr": int(r.nr),
                      "u": uf, "t": "c", "tot": int(r.tot), "el": bool(r.el)} for sq, r in ct.iterrows()]
            cmap = {sq: j for j, sq in enumerate(ct.index)}
            cm = {}
            for r2 in sub.itertuples():
                if r2.QT_VOTOS_NOMINAIS_VALIDOS > 0:
                    cm.setdefault(idx[r2.ibge], []).extend([cmap[r2.SQ_CANDIDATO], int(r2.QT_VOTOS_NOMINAIS_VALIDOS)])
            jdump({"ents": cents, "m": cm}, OUT / "cand" / f"{key}_{uf}.json")
    # municípios
    rows = [None] * len(muns)
    nom = df.groupby("ibge").QT_VOTOS_NOMINAIS_VALIDOS.sum()
    votes = {}
    for r in df.itertuples():
        ci = emap.get(("c", r.SQ_CANDIDATO))
        if ci is not None:
            votes.setdefault(r.ibge, {})
            votes[r.ibge][ci] = votes[r.ibge].get(ci, 0) + int(r.QT_VOTOS_NOMINAIS_VALIDOS)
        if cg in (6, 7, 8):
            pi = emap[("p", r.SG_PARTIDO)]
            votes.setdefault(r.ibge, {})
            votes[r.ibge][pi] = votes[r.ibge].get(pi, 0) + int(r.QT_VOTOS_NOMINAIS_VALIDOS)
    t2 = {v: k for k, v in t2i.items()}
    for ib, vd in votes.items():
        i = idx[ib]
        tcode = t2[ib]
        if tcode in dd.index:
            x = dd.loc[tcode]
            head = [int(x.QT_APTOS), int(x.QT_COMPARECIMENTO), int(x.QT_VOTOS_BRANCOS), int(x.QT_TOTAL_VOTOS_NULOS)]
        else:
            head = [0, 0, 0, 0]
        flat = []
        for ei, v in sorted(vd.items(), key=lambda kv: -kv[1]):
            if v > 0:
                flat += [ei, v]
        rows[i] = head + [int(nom[ib])] + flat
    for sq, r in cand_tot.iterrows():   # índice de busca de candidatos (todos os cargos)
        cand_index.append([key, "" if cg == 1 else r.uf, int(sq), r.nm.title() if r.nm.isupper() else r.nm, r.p, int(r.nr), int(r.tot), int(bool(r.el))])
    out = {"id": key, "cargo": CARGO_NOME[CARGOS[cg]], "cc": CARGOS[cg], "turno": int(tn), "ents": ents, "m": rows}
    jdump(out, OUT / f"res_{key}.json")
    index.append({"id": key, "cc": CARGOS[cg], "cargo": CARGO_NOME[CARGOS[cg]], "turno": int(tn),
                  "label": f"{CARGO_NOME[CARGOS[cg]]} · {tn}º turno", "n": len(ents)})
order = {"pres": 0, "gov": 1, "sen": 2, "dfed": 3, "dest": 4, "ddist": 5}
index.sort(key=lambda x: (order[x["cc"]], x["turno"]))
jdump(index, OUT / "index.json")
jdump(cand_index, OUT / "cands_index.json")
print("ok", [i["id"] for i in index])
