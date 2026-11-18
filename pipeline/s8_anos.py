"""Estágio 8: outros anos (resultados por município).

Uso:  python s8_anos.py [--download] 2002 2004 ... 2024
  anos gerais (2002, 2006, 2010, 2014, 2018, 2022): Presidente, Governador, Senador, Dep. Federal, Estadual e Distrital
  anos municipais (2004, 2008, 2012, 2016, 2020, 2024): Prefeito e Vereador
Com --download baixa os zips do TSE para DATA_DIR (padrão dados/tse_anos); no GitHub Actions usa um diretório temporário.
"""
import json, os, re, sys, urllib.request, zipfile
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *
from pathlib import Path

ANOS = Path(os.environ.get("DATA_DIR") or (ROOT / "dados" / "tse_anos"))
ANOS.mkdir(parents=True, exist_ok=True)
CDN = "https://cdn.tse.jus.br/estatistica/sead"
_t2i = next(p for p in (ROOT / "pipeline" / "tse2ibge.json", CACHE / "tse2ibge.json") if p.exists())
t2i = {int(k): v for k, v in json.load(open(_t2i)).items()}
muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
idx = {m[0]: i for i, m in enumerate(muns)}
CARGO_NOME = {"pres": "Presidente", "gov": "Governador", "sen": "Senador", "dfed": "Deputado Federal", "dest": "Deputado Estadual",
              "ddist": "Deputado Distrital", "pref": "Prefeito", "vere": "Vereador"}
CHUNKED = {"dfed", "dest", "ddist", "pref", "vere"}      # candidatos em arquivos por UF (carregados sob demanda)
INDEXED = {"pres", "gov", "sen", "dfed", "pref"}         # cargos incluídos na busca de candidatos
GERAL = dict(cargos={1: "pres", 3: "gov", 5: "sen", 6: "dfed", 7: "dest", 8: "ddist"}, mode="geral")
MUNI = dict(cargos={11: "pref", 13: "vere"}, mode="muni")
CONFIG = {y: GERAL for y in (1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022)}
CONFIG.update({y: MUNI for y in (1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024)})
ORDER = {"pres": 0, "gov": 1, "sen": 2, "dfed": 3, "dest": 4, "ddist": 5, "pref": 6, "vere": 7}
UFNUM = {u: i + 1 for i, u in enumerate(UFS)}
(OUT / "cand").mkdir(exist_ok=True)
new_index, new_cands = [], []
photo_sqs = {}      # ano -> {SQ: uf}  (candidatos a Presidente/Governador/Senador, para baixar as fotos)


def fetch(url, dest):
    if dest.exists() and dest.stat().st_size > 0:
        return True
    try:
        print("  baixando", url, flush=True)
        urllib.request.urlretrieve(url, dest)
        return True
    except Exception as e:
        print("  falhou:", url, e, flush=True)
        dest.unlink(missing_ok=True)
        return False


def header(zipname, member):
    with zipfile.ZipFile(ANOS / zipname).open(member) as f:
        return list(pd.read_csv(f, sep=";", encoding="latin-1", nrows=0).columns)


def build(year, cfg):
    cargos, mode = cfg["cargos"], cfg["mode"]
    sfx = str(year)[2:]
    cand_zip, det_zip = f"votacao_candidato_munzona_{year}.zip", f"detalhe_votacao_munzona_{year}.zip"
    print(f"== {year} ({mode})", flush=True)
    names = set(zipfile.ZipFile(ANOS / cand_zip).namelist())
    det_names = set(zipfile.ZipFile(ANOS / det_zip).namelist())
    # ---- detalhe da apuração (comparecimento)
    dm = next(n for n in (f"detalhe_votacao_munzona_{year}_BRASIL.csv", f"detalhe_votacao_munzona_{year}_BR.csv") if n in det_names)
    hd = header(det_zip, dm)
    nul = "QT_TOTAL_VOTOS_NULOS" if "QT_TOTAL_VOTOS_NULOS" in hd else "QT_VOTOS_NULOS"
    with zipfile.ZipFile(ANOS / det_zip).open(dm) as f:
        d = pd.read_csv(f, sep=";", encoding="latin-1", dtype={"CD_MUNICIPIO": int},
                        usecols=["SG_UF", "NR_TURNO", "CD_CARGO", "CD_MUNICIPIO", "QT_APTOS", "QT_COMPARECIMENTO", "QT_VOTOS_BRANCOS", nul])
    d = d.rename(columns={nul: "QT_TOTAL_VOTOS_NULOS"})
    d = d[(d.SG_UF != "ZZ") & d.CD_CARGO.isin(cargos)]
    det = d.groupby(["CD_CARGO", "NR_TURNO", "CD_MUNICIPIO"], as_index=False)[
        ["QT_APTOS", "QT_COMPARECIMENTO", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]].sum()
    # ---- votos por candidato
    if mode == "muni":
        members = [f"votacao_candidato_munzona_{year}_{u}.csv" for u in UFS]
    else:   # Presidente vem do arquivo BR; os demais cargos, dos arquivos por UF
        members = [f"votacao_candidato_munzona_{year}_BR.csv"] + [f"votacao_candidato_munzona_{year}_{u}.csv" for u in UFS]
    if mode == "geral" and members[0] not in names and f"votacao_candidato_munzona_{year}_BRASIL.csv" in names:
        members[0] = f"votacao_candidato_munzona_{year}_BRASIL.csv"      # sem arquivo BR: o BRASIL serve de fonte do Presidente
    members = [m for m in members if m in names]
    if not members:
        raise SystemExit(f"nenhum arquivo encontrado em {cand_zip}: {sorted(names)[:8]}")
    hc = header(cand_zip, members[0])
    vcol = "QT_VOTOS_NOMINAIS_VALIDOS" if "QT_VOTOS_NOMINAIS_VALIDOS" in hc else "QT_VOTOS_NOMINAIS"
    print("  coluna de votos:", vcol, "| arquivos:", len(members), flush=True)
    cols = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "CD_CARGO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO", vcol, "DS_SIT_TOT_TURNO"]
    key = ["CD_CARGO", "NR_TURNO", "SG_UF", "CD_MUNICIPIO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO", "DS_SIT_TOT_TURNO"]
    parts = []
    for m in members:
        is_br = m.endswith("_BR.csv") or m.endswith("_BRASIL.csv")
        with zipfile.ZipFile(ANOS / cand_zip).open(m) as f:
            for ch in pd.read_csv(f, sep=";", encoding="latin-1", usecols=cols, chunksize=1_500_000,
                                  dtype={"SQ_CANDIDATO": "int64", "CD_MUNICIPIO": int}):
                ch = ch[(ch.SG_UF != "ZZ") & ch.CD_CARGO.isin(cargos)]
                if mode == "geral":
                    ch = ch[ch.CD_CARGO == 1] if is_br else ch[ch.CD_CARGO != 1]
                ch = ch.copy()
                # anos antigos: SQ_CANDIDATO não é único -> chave composta por abrangência do cargo
                small = ch.SQ_CANDIDATO < 10 ** 9
                if small.any():
                    nr = ch.NR_CANDIDATO.astype("int64"); cg = ch.CD_CARGO.astype("int64")
                    if mode == "muni":
                        new = (ch.CD_MUNICIPIO.astype("int64") * 100 + cg) * 10 ** 6 + nr
                    else:   # cargos estaduais: UF + cargo + número; Presidente: sequencial + número
                        new = np.where(cg == 1, ch.SQ_CANDIDATO * 100000 + nr, (ch.SG_UF.map(UFNUM).fillna(0).astype("int64") * 100 + cg) * 10 ** 6 + nr)
                    ch["SQ_CANDIDATO"] = ch.SQ_CANDIDATO.where(~small, new)
                parts.append(ch.groupby(key, as_index=False, dropna=False)[vcol].sum())
        print("  ", m, flush=True)
    allc = pd.concat(parts, ignore_index=True).groupby(key, as_index=False, dropna=False)[vcol].sum().rename(columns={vcol: "V"})
    allc["ibge"] = allc.CD_MUNICIPIO.map(t2i)
    print("  linhas sem município ibge:", int(allc.ibge.isna().sum()), flush=True)
    allc = allc.dropna(subset=["ibge"]); allc["ibge"] = allc.ibge.astype(int)
    allc["eleito"] = allc.DS_SIT_TOT_TURNO.fillna("").str.upper().str.startswith("ELEITO")
    t2 = {v: k for k, v in t2i.items()}
    title = lambda s: (s.title() if s.isupper() else s) if isinstance(s, str) else "(sem nome)"

    for (cg, tn), df in allc.groupby(["CD_CARGO", "NR_TURNO"]):
        cc = cargos[cg]; kid = f"{cc}{tn}@{sfx}"; fid = kid.replace("@", "_")
        chunked = cc in CHUNKED
        dd = det[(det.CD_CARGO == cg) & (det.NR_TURNO == tn)].set_index("CD_MUNICIPIO")
        ct = df.groupby("SQ_CANDIDATO").agg(tot=("V", "sum"), nm=("NM_URNA_CANDIDATO", "first"), p=("SG_PARTIDO", "first"),
                                            nr=("NR_CANDIDATO", "first"), uf=("SG_UF", "first"), el=("eleito", "max"),
                                            ib=("ibge", "first")).sort_values("tot", ascending=False)
        ents, emap = [], {}
        if not chunked:
            src = ct if cc == "pres" else ct.sort_values(["uf", "tot"], ascending=[True, False])
            for sq, r in src.iterrows():
                emap[("c", sq)] = len(ents)
                ents.append({"k": f"c{sq}", "n": title(r.nm), "p": r.p, "nr": int(r.nr), "u": None if cc == "pres" else r.uf,
                             "t": "c", "tot": int(r.tot), "el": bool(r.el)})
                if cc in ("pres", "gov", "sen") and sq > 10 ** 9:
                    photo_sqs.setdefault(year, {})[int(sq)] = r.uf
        else:
            pt = df.groupby("SG_PARTIDO").V.sum().sort_values(ascending=False)
            for p, v in pt.items():
                emap[("p", p)] = len(ents)
                ents.append({"k": f"p{p}", "n": p, "p": p, "nr": None, "u": None, "t": "p", "tot": int(v), "el": False})
            for uf, sub in df.groupby("SG_UF"):
                cu = ct[ct.uf == uf]
                cents = [{"k": f"c{sq}", "n": title(r.nm), "p": r.p, "nr": int(r.nr), "u": uf, "t": "c", "tot": int(r.tot), "el": bool(r.el)} for sq, r in cu.iterrows()]
                cmap = {sq: j for j, sq in enumerate(cu.index)}
                cm = {}
                for r2 in sub.itertuples():
                    if r2.V > 0:
                        cm.setdefault(idx[r2.ibge], []).extend([cmap[r2.SQ_CANDIDATO], int(r2.V)])
                jdump({"ents": cents, "m": cm}, OUT / "cand" / f"{fid}_{uf}.json")
        votes = {}
        for r in df.itertuples():
            ei = emap.get(("p", r.SG_PARTIDO)) if chunked else emap.get(("c", r.SQ_CANDIDATO))
            if ei is None:
                continue
            dv = votes.setdefault(r.ibge, {}); dv[ei] = dv.get(ei, 0) + int(r.V)
        nom = df.groupby("ibge").V.sum()
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
        if cc in INDEXED and (year > 2000 or cc in ("pres", "gov", "sen")):   # busca de candidatos (anos <= 2000: só majoritários, p/ não inflar o índice)
            for sq, r in ct.iterrows():
                new_cands.append([kid, "" if cc == "pres" else r.uf, int(sq), title(r.nm), r.p, int(r.nr), int(r.tot), int(bool(r.el)),
                                  idx[int(r.ib)] if cc == "pref" else None])


def fotos(year):
    """Fotos oficiais (pacotes por UF do TSE) dos candidatos a Presidente, Governador e Senador, quando existirem."""
    sqs = photo_sqs.get(year)
    if not sqs:
        return
    dst = ROOT / "site" / "fotos"; dst.mkdir(parents=True, exist_ok=True); n = 0
    for u in ["BR"] + sorted(set(sqs.values())):
        z = ANOS / f"foto_cand{year}_{u}_div.zip"
        if not fetch(f"{CDN}/eleicoes/eleicoes{year}/fotos/foto_cand{year}_{u}_div.zip", z):
            continue
        with zipfile.ZipFile(z) as zf:
            for info in zf.infolist():
                m = re.match(r"^F[A-Z]{2}(\d+)_div\.jpg$", info.filename)
                if m and int(m.group(1)) in sqs:
                    (dst / f"{m.group(1)}.jpg").write_bytes(zf.read(info)); n += 1
        z.unlink(missing_ok=True)
    print("  fotos", year, ":", n, flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    download = "--download" in args
    years = [int(a) for a in args if a.isdigit()] or [2022, 2024]
    for y in years:
        if download:
            ok = fetch(f"{CDN}/odsele/votacao_candidato_munzona/votacao_candidato_munzona_{y}.zip", ANOS / f"votacao_candidato_munzona_{y}.zip") and \
                 fetch(f"{CDN}/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_{y}.zip", ANOS / f"detalhe_votacao_munzona_{y}.zip")
            if not ok:
                raise SystemExit(f"não foi possível baixar os dados de {y}")
        build(y, CONFIG[y])
        fotos(y)
        for z in (ANOS / f"votacao_candidato_munzona_{y}.zip", ANOS / f"detalhe_votacao_munzona_{y}.zip"):
            if download:
                z.unlink(missing_ok=True)       # libera disco do runner

    # ---- índices: mantém tudo que já existe, regrava só os anos processados agora
    built = set(years)
    old = json.load(open(OUT / "index.json", encoding="utf-8"))
    keep = []
    for e in old:
        e.setdefault("year", 2026)
        if e["year"] == 2026 and not e["label"].endswith("2026"):
            e["label"] = f"{e['cargo']} · {e['turno']}º turno · 2026"
        if e["year"] not in built:
            keep.append(e)
    idxs = sorted(keep + new_index, key=lambda e: (-e["year"], ORDER[e["cc"]], e["turno"]))
    jdump(idxs, OUT / "index.json")
    suf = tuple(f"@{str(y)[2:]}" for y in built)
    oc = [c for c in json.load(open(OUT / "cands_index.json", encoding="utf-8")) if not c[0].endswith(suf)]
    jdump(oc + new_cands, OUT / "cands_index.json")
    print("índice:", len(idxs), "conjuntos;", len(oc) + len(new_cands), "candidatos na busca", flush=True)
