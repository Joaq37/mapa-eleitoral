"""Estágio 7: emendas parlamentares individuais (Portal da Transparência/CGU) por autor e município."""
import json, re, sys, zipfile
from collections import Counter, defaultdict
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
idx = {m[0]: i for i, m in enumerate(muns)}
z = zipfile.ZipFile(ROOT / "dados" / "emendas" / "emendas_parlamentares.zip")
with z.open("EmendasParlamentares.csv") as f:
    d = pd.read_csv(f, sep=";", encoding="latin-1", dtype=str)
d.columns = [c.strip() for c in d.columns]
print("linhas:", len(d))
def num(s):
    return pd.to_numeric(s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False), errors="coerce").fillna(0.0)
d["emp"] = num(d["Valor Empenhado"])
d["pago"] = num(d["Valor Pago"]) + num(d["Valor Restos A Pagar Pagos"])
d["ano"] = pd.to_numeric(d["Ano da Emenda"], errors="coerce")
tipo = d["Tipo de Emenda"].fillna("")
d["t"] = tipo.map(lambda s: "Pix (transf. especial)" if "Especia" in s else "Individual (finalidade definida)" if "Individual" in s else "Outras")
d = d[(d["Tipo de Emenda"].str.contains("Individual", na=False)) & d["Nome do Autor da Emenda"].notna()
      & ~d["Nome do Autor da Emenda"].str.contains("Sem informa|BANCADA|COMISS|RELATOR", case=False, na=False)]
print("emendas individuais com autor:", len(d), " autores:", d["Nome do Autor da Emenda"].nunique())

d["k"] = d["Nome do Autor da Emenda"].map(norm)

# onde o dinheiro chegou: município do favorecido (arquivo PorFavorecido, 2020+)
by_mun = {(m[3], norm(m[2])): i for i, m in enumerate(muns)}
with z.open("EmendasParlamentares_PorFavorecido.csv") as f:
    pf = pd.read_csv(f, sep=";", encoding="latin-1", dtype=str,
                     usecols=["Nome do Autor da Emenda", "Tipo de Emenda", "UF Favorecido", "Município Favorecido", "Valor Recebido"])
pf = pf[pf["Tipo de Emenda"].str.contains("Individual", na=False)].copy()
pf["k"] = pf["Nome do Autor da Emenda"].map(norm)
pf["v"] = num(pf["Valor Recebido"])
pf["mi"] = [by_mun.get((u, norm(m))) for u, m in zip(pf["UF Favorecido"], pf["Município Favorecido"].fillna(""))]
print("favorecidos:", len(pf), " com município:", int(pf.mi.notna().sum()), " (", round(pf.loc[pf.mi.notna(), 'v'].sum() / pf.v.sum() * 100, 1), "% do valor )")
pfm = pf[pf.mi.notna()].groupby(["k", "mi"]).v.sum()
pfuf = pf[pf.mi.notna()].groupby(["k", "UF Favorecido"]).v.sum().reset_index().sort_values("v", ascending=False).drop_duplicates("k").set_index("k")["UF Favorecido"]

authors, amap = [], {}
mrows = {}
for k, g in d.groupby("k"):
    nome = g["Nome do Autor da Emenda"].iloc[0].title()
    a = {"n": nome, "k": k, "uf": pfuf.get(k, ""),
         "emp": round(float(g.emp.sum()), 2), "pago": round(float(g.pago.sum()), 2),
         "y": {int(y): [round(float(x.emp.sum()), 2), round(float(x.pago.sum()), 2)] for y, x in g.groupby("ano") if y == y},
         "t": {t: [round(float(x.emp.sum()), 2), round(float(x.pago.sum()), 2)] for t, x in g.groupby("t")},
         "f": {fn: round(float(x.emp.sum()), 2) for fn, x in sorted(g.groupby("Nome Função"), key=lambda kv: -kv[1].emp.sum())[:6]}}
    amap[k] = len(authors); authors.append(a)
    if k in pfm.index.get_level_values(0):
        sub = pfm.loc[k]
        mrows[amap[k]] = [[int(i), round(float(v), 2)] for i, v in sub.items() if v > 0]
        a["rec"] = round(float(sub.sum()), 2)

# vínculo autor -> candidato 2026 (Dep. Federal / Senador), por nome de urna; desempate pela UF dominante das emendas
cands = json.load(open(OUT / "cands_index.json", encoding="utf-8"))
byname = defaultdict(list)
for c in cands:
    if c[0] in ("dfed1", "sen1"):
        byname[norm(c[3])].append(c)
links = {}
for k, ai in amap.items():
    lst = byname.get(k)
    if not lst:
        continue
    if len(lst) > 1:
        lst = [c for c in lst if c[1] == authors[ai]["uf"]] or []
    if len(lst) >= 1:
        c = max(lst, key=lambda c: c[6])
        links[f"{c[0]}|c{c[2]}"] = ai
print("autores:", len(authors), " vinculados a candidatos 2026:", len(links))
tot = sum(a["pago"] for a in authors)
print("total pago (individuais):", round(tot / 1e9, 2), "bi; anos:", d.ano.min(), d.ano.max())
jdump({"authors": authors, "m": {str(k): v for k, v in mrows.items()}, "links": links,
       "fonte": "Portal da Transparência (CGU) — emendas parlamentares individuais"}, OUT / "emendas.json")
