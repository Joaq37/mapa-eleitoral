"""Estágio 8: outros anos — Presidente 2022 e Prefeito/Vereador 2024 (resultados por município)."""
import json, re, sys, zipfile
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

ANOS = ROOT / "dados" / "tse_anos"
t2i = {int(k): v for k, v in json.load(open(CACHE / "tse2ibge.json")).items()}
muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
idx = {m[0]: i for i, m in enumerate(muns)}
CARGO_NOME = {"pres": "Presidente", "pref": "Prefeito", "vere": "Vereador"}
(OUT / "cand").mkdir(exist_ok=True)

new_index, new_cands = [], []


def zo(zipname, member):
    return zipfile.ZipFile(ANOS / zipname).open(member)


def build(year, cargos, cand_zip, det_zip, members, chunked):
    sfx = str(year)[2:]
    print(f"== {year}")
    with zo(det_zip, f"detalhe_votacao_munzona_{year}_BRASIL.csv") as f:
        d = pd.read_csv(f, sep=";", encoding="latin-1", dtype={"CD_MUNICIPIO": int},
                        usecols=["SG_UF", "NR_TURNO", "CD_CARGO", "CD_MUNICIPIO", "QT_APTOS", "QT_COMPARECIMENTO",
                                 "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"])
    d = d[(d.SG_UF != "ZZ") & d.CD_CARGO.isin(cargos)]
    det = d.groupby(["CD_CARGO", "NR_TURNO", "CD_MUNICIPIO"], as_index=False)[
        ["QT_APTOS", "QT_COMPARECIMENTO", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]].sum()
    cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "CD_CARGO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO",
            "SG_PARTIDO", "QT_VOTOS_NOMINAIS_VALIDOS", "DS_SIT_TOT_TURNO"]
    key = ["CD_CARGO", "NR_TURNO", "SG_UF", "CD_MUNICIPIO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO", "DS_SIT_TOT_TURNO"]
    parts = []
    names = set(zipfile.ZipFile(ANOS / cand_zip).namelist())
    for m in [m for m in members if m in names]:   # ex.: DF não tem eleição municipal
        with zo(cand_zip, m) as f:
            for ch in pd.read_csv(f, sep=";", encoding="latin-1", usecols=cols, chunksize=1_500_000,
                                  dtype={"SQ_CANDIDATO": "int64", "CD_MUNICIPIO": int}):
                ch = ch[(ch.SG_UF != "ZZ") & ch.CD_CARGO.isin(cargos)]
                parts.append(ch.groupby(key, as_index=False, dropna=False)["QT_VOTOS_NOMINAIS_VALIDOS"].sum())
        print("  ", m)
    allc = pd.concat(parts, ignore_index=True).groupby(key, as_index=False, dropna=False)["QT_VOTOS_NOMINAIS_VALIDOS"].sum()
    allc["ibge"] = allc.CD_MUNICIPIO.map(t2i)
    print("  sem ibge:", int(allc.ibge.isna().sum()))
    allc = allc.dropna(subset=["ibge"]); allc["ibge"] = allc.ibge.astype(int)
    allc["eleito"] = allc.DS_SIT_TOT_TURNO.fillna("").str.upper().str.startswith("ELEITO")
    t2 = {v: k for k, v in t2i.items()}

    for (cg, tn), df in allc.groupby(["CD_CARGO", "NR_TURNO"]):
        cc = cargos[cg]; kid = f"{cc}{tn}@{sfx}"; fid = kid.replace("@", "_")
        dd = det[(det.CD_CARGO == cg) & (det.NR_TURNO == tn)].set_index("CD_MUNICIPIO")
        ct = df.groupby("SQ_CANDIDATO").agg(tot=("QT_VOTOS_NOMINAIS_VALIDOS", "sum"), nm=("NM_URNA_CANDIDATO", "first"),
                                            p=("SG_PARTIDO", "first"), nr=("NR_CANDIDATO", "first"), uf=("SG_UF", "first"),
                                            el=("eleito", "max"), ib=("ibge", "first")).sort_values("tot", ascending=False)
        title = lambda s: (s.title() if s.isupper() else s) if isinstance(s, str) else "(sem nome)"
        ents, emap = [], {}
        if not chunked:
            for sq, r in ct.iterrows():
                emap[("c", sq)] = len(ents)
                ents.append({"k": f"c{sq}", "n": title(r.nm), "p": r.p, "nr": int(r.nr), "u": None, "t": "c", "tot": int(r.tot), "el": bool(r.el)})
        else:
            pt = df.groupby("SG_PARTIDO").QT_VOTOS_NOMINAIS_VALIDOS.sum().sort_values(ascending=False)
            for p, v in pt.items():
                emap[("p", p)] = len(ents)
                ents.append({"k": f"p{p}", "n": p, "p": p, "nr": None, "u": None, "t": "p", "tot": int(v), "el": False})
            for uf, sub in df.groupby("SG_UF"):
                cu = ct[ct.uf == uf]
                cents = [{"k": f"c{sq}", "n": title(r.nm), "p": r.p, "nr": int(r.nr), "u": uf, "t": "c", "tot": int(r.tot), "el": bool(r.el)} for sq, r in cu.iterrows()]
                cmap = {sq: j for j, sq in enumerate(cu.index)}
                cm = {}
                for r2 in sub.itertuples():
                    if r2.QT_VOTOS_NOMINAIS_VALIDOS > 0:
                        cm.setdefault(idx[r2.ibge], []).extend([cmap[r2.SQ_CANDIDATO], int(r2.QT_VOTOS_NOMINAIS_VALIDOS)])
                jdump({"ents": cents, "m": cm}, OUT / "cand" / f"{fid}_{uf}.json")
        votes = {}
        for r in df.itertuples():
            ei = emap.get(("c", r.SQ_CANDIDATO)) if not chunked else emap[("p", r.SG_PARTIDO)]
            if ei is None:
                continue
            dv = votes.setdefault(r.ibge, {}); dv[ei] = dv.get(ei, 0) + int(r.QT_VOTOS_NOMINAIS_VALIDOS)
        nom = df.groupby("ibge").QT_VOTOS_NOMINAIS_VALIDOS.sum()
        rows = [None] * len(muns)
        for ib, vd in votes.items():
            tcode = t2[ib]
            if tcode in dd.index:
                x = dd.loc[tcode]; head = [int(x.QT_APTOS), int(x.QT_COMPARECIMENTO), int(x.QT_VOTOS_BRANCOS), int(x.QT_TOTAL_VOTOS_NULOS)]
            else:
                head = [0, 0, 0, 0]
            flat = []
            for ei, v in sorted(vd.items(), key=lambda kv: -kv[1]):
                if v > 0:
                    flat += [ei, v]
            rows[idx[ib]] = head + [int(nom[ib])] + flat
        cargo = CARGO_NOME[cc]
        jdump({"id": kid, "cargo": cargo, "cc": cc, "turno": int(tn), "year": year, "ents": ents, "m": rows}, OUT / f"res_{fid}.json")
        new_index.append({"id": kid, "cc": cc, "cargo": cargo, "turno": int(tn), "year": year, "label": f"{cargo} · {tn}º turno · {year}", "n": len(ents)})
        if cc in ("pres", "pref"):                      # busca de candidatos: presidente e prefeito
            for sq, r in ct.iterrows():
                new_cands.append([kid, "" if cc == "pres" else r.uf, int(sq), title(r.nm), r.p, int(r.nr), int(r.tot), int(bool(r.el)),
                                  None if cc == "pres" else idx[int(r.ib)]])


build(2022, {1: "pres"}, "votacao_candidato_munzona_2022.zip", "detalhe_votacao_munzona_2022.zip",
      ["votacao_candidato_munzona_2022_BR.csv"], chunked=False)
build(2024, {11: "pref", 13: "vere"}, "votacao_candidato_munzona_2024.zip", "detalhe_votacao_munzona_2024.zip",
      [f"votacao_candidato_munzona_2024_{u}.csv" for u in UFS], chunked=True)

# ---- índice: mantém 2026, regrava anos novos
old = json.load(open(OUT / "index.json", encoding="utf-8"))
keep = []
for e in old:
    if e.get("year", 2026) == 2026:
        e["year"] = 2026
        e["label"] = f"{e['cargo']} · {e['turno']}º turno · 2026"
        keep.append(e)
order = {"pres": 0, "gov": 1, "sen": 2, "dfed": 3, "dest": 4, "ddist": 5, "pref": 6, "vere": 7}
idxs = sorted(keep + new_index, key=lambda e: (-e["year"], order[e["cc"]], e["turno"]))
jdump(idxs, OUT / "index.json")
oc = json.load(open(OUT / "cands_index.json", encoding="utf-8"))
oc = [c for c in oc if "@" not in c[0]]
jdump(oc + new_cands, OUT / "cands_index.json")

# ---- fotos do Presidente 2022
dst = ROOT / "site" / "fotos"; n = 0
with zipfile.ZipFile(ANOS / "foto_cand2022_BR_div.zip") as zf:
    for info in zf.infolist():
        m = re.match(r"^F[A-Z]{2}(\d+)_div\.jpg$", info.filename)
        if m:
            (dst / f"{m.group(1)}.jpg").write_bytes(zf.read(info)); n += 1
print("fotos 2022:", n, " índice:", [e["id"] for e in idxs])
