"""Estágio 3: perfil do eleitorado por município."""
import json, sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

t2i = {int(k): v for k, v in json.load(open(CACHE / "tse2ibge.json")).items()}
muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
idx = {m[0]: i for i, m in enumerate(muns)}
cols = ["CD_MUNICIPIO", "DS_GENERO", "CD_FAIXA_ETARIA", "DS_GRAU_ESCOLARIDADE", "DS_RACA_COR",
        "QT_ELEITORES", "QT_ELEITORES_BIOMETRIA", "QT_ELEITORES_DEFICIENCIA"]
acc = {k: [] for k in ["tot", "gen", "age", "esc", "raca"]}
for u in UFS:
    n = 0
    with zopen("perfil_eleitorado_2026.zip", f"perfil_eleitorado_2026_{u}.csv") as f:
        for ch in pd.read_csv(f, sep=";", encoding="latin-1", usecols=cols, chunksize=2_000_000,
                              dtype={"CD_MUNICIPIO": int, "CD_FAIXA_ETARIA": int, "DS_RACA_COR": str}):
            ch["age"] = (ch.CD_FAIXA_ETARIA // 100).clip(upper=100)
            ch["ageb"] = pd.cut(ch.age, [0, 24, 34, 44, 59, 200], labels=["a1624", "a2534", "a3544", "a4559", "a60"])
            acc["tot"].append(ch.groupby("CD_MUNICIPIO")[["QT_ELEITORES", "QT_ELEITORES_BIOMETRIA", "QT_ELEITORES_DEFICIENCIA"]].sum())
            acc["gen"].append(ch.groupby(["CD_MUNICIPIO", "DS_GENERO"]).QT_ELEITORES.sum())
            acc["age"].append(ch.groupby(["CD_MUNICIPIO", "ageb"], observed=True).QT_ELEITORES.sum())
            acc["esc"].append(ch.groupby(["CD_MUNICIPIO", "DS_GRAU_ESCOLARIDADE"]).QT_ELEITORES.sum())
            acc["raca"].append(ch.groupby(["CD_MUNICIPIO", "DS_RACA_COR"]).QT_ELEITORES.sum())
            n += len(ch)
    print(u, n)

tot = pd.concat(acc["tot"]).groupby(level=0).sum()
gen = pd.concat(acc["gen"]).groupby(level=[0, 1]).sum().unstack(fill_value=0)
age = pd.concat(acc["age"]).groupby(level=[0, 1]).sum().unstack(fill_value=0)
esc = pd.concat(acc["esc"]).groupby(level=[0, 1]).sum().unstack(fill_value=0)
raca = pd.concat(acc["raca"]).groupby(level=[0, 1]).sum().unstack(fill_value=0)
print("gênero:", list(gen.columns)); print("escolaridade:", list(esc.columns)); print("raça:", list(raca.columns))
print("raça (nacional):", raca.sum().to_dict())

E = tot.QT_ELEITORES
def pct(num, den=E):
    return (num / den.clip(lower=1) * 100)

feats = {}
feats["fem"] = pct(gen.get("FEMININO", 0))
for k, lab in zip(["a1624", "a2534", "a3544", "a4559", "a60"], ["i1624", "i2534", "i3544", "i4559", "i60"]):
    feats[lab] = pct(age[k])
def cols_like(df, *keys):
    c = [x for x in df.columns if any(x.upper().startswith(k) for k in keys)]
    return df[c].sum(axis=1)
baixa = esc[[c for c in esc.columns if c.upper() in ("ANALFABETO", "LÊ E ESCREVE", "ENSINO FUNDAMENTAL INCOMPLETO")]].sum(axis=1)
fund = esc[[c for c in esc.columns if c.upper() == "ENSINO FUNDAMENTAL COMPLETO"]].sum(axis=1)
medio = esc[[c for c in esc.columns if c.upper().startswith("ENSINO MÉDIO")]].sum(axis=1)
sup = esc[[c for c in esc.columns if c.upper().startswith("SUPERIOR")]].sum(axis=1)
feats["esc_baixa"] = pct(baixa); feats["esc_fund"] = pct(fund); feats["esc_medio"] = pct(medio); feats["esc_sup"] = pct(sup)
feats["bio"] = pct(tot.QT_ELEITORES_BIOMETRIA)
feats["defic"] = pct(tot.QT_ELEITORES_DEFICIENCIA)
# raça/cor entre os que informaram
inf = raca[[c for c in raca.columns if "INFORMADO" not in c.upper()]]
infs = inf.sum(axis=1)
feats["raca_inf"] = pct(infs)
low = {c.upper(): c for c in inf.columns}
def rc(name):
    return inf[low[name]] if name in low else 0
feats["raca_negra"] = pct(rc("PRETA") + rc("PARDA"), infs)
feats["raca_branca"] = pct(rc("BRANCA"), infs)
feats["raca_indig"] = pct(rc("INDÍGENA"), infs)

meta = [
    ("elei", "Eleitorado (nº de eleitores)", "Perfil do eleitorado"),
    ("fem", "% eleitoras mulheres", "Perfil do eleitorado"),
    ("i1624", "% eleitores 16–24 anos", "Idade"), ("i2534", "% eleitores 25–34 anos", "Idade"),
    ("i3544", "% eleitores 35–44 anos", "Idade"), ("i4559", "% eleitores 45–59 anos", "Idade"),
    ("i60", "% eleitores 60+ anos", "Idade"),
    ("esc_baixa", "% até fundamental incompleto", "Escolaridade"), ("esc_fund", "% fundamental completo", "Escolaridade"),
    ("esc_medio", "% ensino médio", "Escolaridade"), ("esc_sup", "% ensino superior", "Escolaridade"),
    ("bio", "% com biometria", "Perfil do eleitorado"), ("defic", "% com deficiência", "Perfil do eleitorado"),
    ("raca_inf", "% que declararam raça/cor", "Raça/cor (declarada)"),
    ("raca_negra", "% pretos+pardos (entre declarantes)", "Raça/cor (declarada)"),
    ("raca_branca", "% brancos (entre declarantes)", "Raça/cor (declarada)"),
    ("raca_indig", "% indígenas (entre declarantes)", "Raça/cor (declarada)"),
]
vals = {k: [None] * len(muns) for k, _, _ in meta}
for tcode in tot.index:
    ib = t2i.get(int(tcode))
    if ib is None:
        continue
    i = idx[ib]
    vals["elei"][i] = int(E[tcode])
    for k in feats:
        v = feats[k][tcode]
        vals[k][i] = None if not np.isfinite(v) else round(float(v), 2)
jdump({"vars": [{"id": k, "label": l, "group": g} for k, l, g in meta], "v": vals}, OUT / "demo.json")
