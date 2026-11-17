"""Estágio 5: indicadores do IBGE por município (Censo 2022, PIB dos Municípios 2023, CEMPRE 2024)."""
import json, math, sys, time, urllib.request
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import *

BASE = "https://servicodados.ibge.gov.br/api/v3/agregados"
muns = json.load(open(OUT / "muns.json", encoding="utf-8"))
codes = [m[0] for m in muns]


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("   retry", k, str(e)[:80]); time.sleep(3)
    raise RuntimeError(url)


def num(x):
    try:
        v = float(x)
        return v if math.isfinite(v) else None
    except Exception:
        return None


def fetch(table, period, var, cls="", by=None):
    """Retorna {categoria: {cod_ibge: valor}}. `by` = id da classificação que varia (None -> chave 'v')."""
    url = f"{BASE}/{table}/periodos/{period}/variaveis/{var}?localidades=N6[all]" + (f"&classificacao={cls}" if cls else "")
    data = get(url)
    out = {}
    for res in data[0]["resultados"]:
        key = "v"
        if by is not None:
            key = None
            for c in res["classificacoes"]:
                if str(c["id"]) == str(by):
                    key = int(list(c["categoria"].keys())[0])
        d = out.setdefault(key, {})
        for s in res["series"]:
            d[int(s["localidade"]["id"])] = num(list(s["serie"].values())[0])
    n = max(len(v) for v in out.values())
    print(f"  tabela {table} var {var}: {n} municípios, categorias {list(out)}")
    return out


V = {}      # id -> {cod: val}
META = []   # (id, label, group)
def add(id_, label, group, d):
    V[id_] = d; META.append((id_, label, group))

G_DEM, G_RACA, G_REL, G_EDU, G_RENDA, G_ECO, G_SAN = ("IBGE · Demografia", "IBGE · Cor/raça (Censo 2022)", "IBGE · Religião (Censo 2022)",
    "IBGE · Educação", "IBGE · Renda", "IBGE · Economia", "IBGE · Saneamento")
SEX, COR = "2[6794]", "86[95251]"

print("demografia")
pop = fetch(4714, 2022, 93)["v"]; area = fetch(4714, 2022, 6318)["v"]; dens = fetch(4714, 2022, 614)["v"]
add("pop", "População (Censo 2022)", G_DEM, pop)
add("logpop", "População — log10 (Censo 2022)", G_DEM, {k: math.log10(v) for k, v in pop.items() if v and v > 0})
add("dens", "Densidade demográfica (hab/km²)", G_DEM, dens)
add("logdens", "Densidade demográfica — log10", G_DEM, {k: math.log10(v) for k, v in dens.items() if v and v > 0})
add("cresc", "Crescimento populacional 2010–2022 (% a.a.)", G_DEM, fetch(4709, 2022, 10605)["v"])
add("urb", "% população urbana", G_DEM, fetch(9923, 2022, 1000093, "1[1]", by=1)[1])
add("idade_med", "Idade mediana (anos)", G_DEM, fetch(9515, 2022, 10613)["v"])
add("envel", "Índice de envelhecimento", G_DEM, fetch(9515, 2022, 10612)["v"])

print("cor/raça")
cr = fetch(9605, 2022, 1000093, "86[2776,2777,2778,2779,2780]", by=86)
for k, nm in ((2776, "brancos"), (2777, "pretos"), (2779, "pardos"), (2778, "amarelos"), (2780, "indígenas")):
    add("r_" + nm, f"% {nm} (Censo 2022)", G_RACA, cr[k])
add("r_negros", "% pretos + pardos (Censo 2022)", G_RACA, {k: (cr[2777].get(k) or 0) + (cr[2779].get(k) or 0) for k in cr[2777] if cr[2777].get(k) is not None})

print("religião")
rl = fetch(9537, 2022, 13495, "133[95263,95277,2826,2827,2836]|2[6794]|58[95253]", by=133)
for k, nm in ((95263, "católicos"), (95277, "evangélicos"), (2826, "espíritas"), (2827, "umbanda/candomblé"), (2836, "sem religião")):
    add("rel_" + str(k), f"% {nm} (10+ anos)", G_REL, rl[k])

print("educação")
add("alfab", "Taxa de alfabetização 15+ (%)", G_EDU, fetch(9543, 2022, 2513, "2[6794]|86[95251]|287[100362]")["v"])
ni = fetch(10061, 2022, 1002667, "1568[9493,9494,9495,99713]|58[95253]|2[6794]|86[95251]", by=1568)
add("ni_baixa", "% 18+ sem instrução ou fundamental incompleto", G_EDU, ni[9493])
add("ni_fund", "% 18+ fundamental completo ou médio incompleto", G_EDU, ni[9494])
add("ni_medio", "% 18+ médio completo ou superior incompleto", G_EDU, ni[9495])
add("ni_sup", "% 18+ superior completo", G_EDU, ni[99713])

print("renda")
add("renda_pc", "Rendimento domiciliar per capita médio (R$)", G_RENDA, fetch(10295, 2022, 13431, SEX + "|" + COR)["v"])
add("renda_pc_med", "Rendimento domiciliar per capita mediano (R$)", G_RENDA, fetch(10295, 2022, 13534, SEX + "|" + COR)["v"])
cl = fetch(10296, 2022, 1013604, "386[9681,9682]|" + SEX + "|" + COR, by=386)
add("baixa_renda", "% moradores com renda até 1/2 salário mínimo", G_RENDA, {k: (cl[9681].get(k) or 0) + (cl[9682].get(k) or 0) for k in cl[9681] if cl[9681].get(k) is not None})
add("renda_trab", "Rendimento médio do trabalho (R$)", G_RENDA, fetch(10289, 2022, 13536, SEX + "|" + COR)["v"])

print("economia")
pib = fetch(5938, 2023, 37)["v"]
for P in (2023, 2022, 2021):   # a composição setorial pode ter defasagem em relação ao PIB total
    vab = fetch(5938, P, 498)["v"]
    if sum(1 for v in vab.values() if v) > 5000:
        break
print("  VAB setorial: ano", P)
ag = fetch(5938, P, 513)["v"]; ind = fetch(5938, P, 517)["v"]; sv = fetch(5938, P, 6575)["v"]; ad = fetch(5938, P, 525)["v"]
pibpc = {k: pib[k] * 1000 / pop[k] for k in pib if pib.get(k) and pop.get(k)}
add("pibpc", "PIB per capita 2023 (R$)", G_ECO, pibpc)
add("logpibpc", "PIB per capita 2023 — log10", G_ECO, {k: math.log10(v) for k, v in pibpc.items() if v > 0})
for key, lab, d in (("va_agro", "agropecuária", ag), ("va_ind", "indústria", ind), ("va_serv", "serviços (exceto adm. pública)", sv), ("va_adm", "administração pública, saúde e educação", ad)):
    add(key, f"% do valor adicionado ({P}): {lab}", G_ECO, {k: d[k] / vab[k] * 100 for k in vab if vab.get(k) and d.get(k) is not None})
po = fetch(9509, 2024, 708)["v"]; em = fetch(9509, 2024, 367)["v"]
add("emprego_formal", "Empregos formais assalariados por 100 habitantes (2024)", G_ECO, {k: po[k] / pop[k] * 100 for k in po if po.get(k) is not None and pop.get(k)})
add("empresas", "Empresas por 1.000 habitantes (2024)", G_ECO, {k: em[k] / pop[k] * 1000 for k in em if em.get(k) is not None and pop.get(k)})
add("salario_sm", "Salário médio mensal formal (salários mínimos, 2024)", G_ECO, fetch(9509, 2024, 1606)["v"])

print("saneamento")
add("agua_rede", "% domicílios com água de rede geral", G_SAN, fetch(6804, 2022, 1000381, "301[31471]|1817[72125]", by=301)[31471])
add("esgoto_rede", "% domicílios com esgoto por rede geral/pluvial", G_SAN, fetch(6805, 2022, 1000381, "11558[46290]", by=11558)[46290])
add("lixo_col", "% domicílios com lixo coletado", G_SAN, fetch(6892, 2022, 1000381, "67[2520]", by=67)[2520])

vals = {}
for id_, _, _ in META:
    d = V[id_]
    vals[id_] = [None if d.get(c) is None else round(d[c], 3) for c in codes]
    miss = sum(1 for x in vals[id_] if x is None)
    if miss > 60:
        print("   AVISO:", id_, "faltam", miss)
jdump({"vars": [{"id": i, "label": l, "group": g} for i, l, g in META], "v": vals}, OUT / "ibge.json")
