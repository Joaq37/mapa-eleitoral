"""Utilidades compartilhadas do pipeline de dados (TSE 2026 + IBGE)."""
import json, re, unicodedata, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TSE = ROOT / "dados" / "tse_2026"
GEO = ROOT / "raw_geo"
OUT = ROOT / "site" / "data"
CACHE = ROOT / "pipeline" / "cache"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI",
       "PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"]
UF_COD = {11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",21:"MA",22:"PI",23:"CE",24:"RN",
          25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",31:"MG",32:"ES",33:"RJ",35:"SP",41:"PR",42:"SC",
          43:"RS",50:"MS",51:"MT",52:"GO",53:"DF"}
UF_NOME = {"AC":"Acre","AL":"Alagoas","AM":"Amazonas","AP":"Amapá","BA":"Bahia","CE":"Ceará",
           "DF":"Distrito Federal","ES":"Espírito Santo","GO":"Goiás","MA":"Maranhão","MG":"Minas Gerais",
           "MS":"Mato Grosso do Sul","MT":"Mato Grosso","PA":"Pará","PB":"Paraíba","PE":"Pernambuco",
           "PI":"Piauí","PR":"Paraná","RJ":"Rio de Janeiro","RN":"Rio Grande do Norte","RO":"Rondônia",
           "RR":"Roraima","RS":"Rio Grande do Sul","SC":"Santa Catarina","SE":"Sergipe","SP":"São Paulo",
           "TO":"Tocantins"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def zopen(zipname: str, member: str):
    z = zipfile.ZipFile(TSE / zipname)
    return z.open(member)


def jdump(obj, path, **kw):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), **kw)
    print("  ->", Path(path).name, round(Path(path).stat().st_size / 1e6, 2), "MB")
