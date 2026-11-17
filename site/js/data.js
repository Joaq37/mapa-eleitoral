// Carregamento de dados e registro de variáveis (cada variável = um vetor com 1 valor por município).
export const UF_NOME = {AC:"Acre",AL:"Alagoas",AM:"Amazonas",AP:"Amapá",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",
  ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MG:"Minas Gerais",MS:"Mato Grosso do Sul",MT:"Mato Grosso",PA:"Pará",
  PB:"Paraíba",PE:"Pernambuco",PI:"Piauí",PR:"Paraná",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RO:"Rondônia",
  RR:"Roraima",RS:"Rio Grande do Sul",SC:"Santa Catarina",SE:"Sergipe",SP:"São Paulo",TO:"Tocantins"};
export const REGIAO = {AC:"Norte",AM:"Norte",AP:"Norte",PA:"Norte",RO:"Norte",RR:"Norte",TO:"Norte",
  AL:"Nordeste",BA:"Nordeste",CE:"Nordeste",MA:"Nordeste",PB:"Nordeste",PE:"Nordeste",PI:"Nordeste",RN:"Nordeste",SE:"Nordeste",
  DF:"Centro-Oeste",GO:"Centro-Oeste",MS:"Centro-Oeste",MT:"Centro-Oeste",ES:"Sudeste",MG:"Sudeste",RJ:"Sudeste",SP:"Sudeste",
  PR:"Sul",RS:"Sul",SC:"Sul"};
export const REGIAO_COR = {Norte:"#2a9d8f",Nordeste:"#e9a23b",Sudeste:"#4c7bd9",Sul:"#9b5de5","Centro-Oeste":"#e5566d"};

export const S = { muns: [], idx: new Map(), N: 0, uf: [], nome: [], ibge: [], index: [], ds: {}, demo: null, ibgeD: null,
  locais: {}, chunks: {}, cands: [], candUF: new Map() };

export const fid = (id) => id.replace("@", "_");
// "pres1@22" -> { cc: "pres", turno: 1, year: 2022 }; ids sem sufixo são 2026
export function parseDs(ds) {
  const m = /^([a-z]+)(\d)(?:@(\d\d))?$/.exec(ds);
  return { cc: m[1], turno: +m[2], year: m[3] ? 2000 + +m[3] : 2026 };
}
export const dsId = (cc, turno, year) => cc + turno + (year === 2026 ? "" : "@" + String(year).slice(2));
const j = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); };

export async function loadAll(progress) {
  const [muns, index, demo, ibgeD, cands, em] = await Promise.all([j("data/muns.json"), j("data/index.json"), j("data/demo.json"),
    j("data/ibge.json"), j("data/cands_index.json"), j("data/emendas.json")]);
  S.muns = muns; S.N = muns.length; S.index = index; S.demo = demo; S.ibgeD = ibgeD; S.cands = cands; S.em = em;
  em.byMun = new Map();
  for (const [ai, rows] of Object.entries(em.m)) for (const [mi, v] of rows) { if (!em.byMun.has(mi)) em.byMun.set(mi, []); em.byMun.get(mi).push([+ai, v]); }
  muns.forEach((m, i) => { S.idx.set(m[0], i); S.ibge.push(m[0]); S.nome.push(m[2]); S.uf.push(m[3]); });
  for (const c of cands) S.candUF.set(`${c[0]}|c${c[2]}`, c[1]);
  let done = 0;
  await Promise.all(index.map(async (d) => {
    const r = await j(`data/res_${fid(d.id)}.json`);
    S.ds[d.id] = prepDataset(r);
    progress && progress(++done / index.length);
  }));
}

function prepDataset(r) {
  r.entIdx = new Map(r.ents.map((e, i) => [e.k, i]));
  r.isDep = r.ents.length > 0 && r.ents.every((e) => e.t === "p");
  const N = S.N;
  r.valid = new Float64Array(N).fill(NaN);   // votos nominais válidos
  r.apt = new Float64Array(N).fill(NaN); r.comp = new Float64Array(N).fill(NaN);
  r.bra = new Float64Array(N).fill(NaN); r.nul = new Float64Array(N).fill(NaN);
  r.win = new Int32Array(N).fill(-1); r.winShare = new Float64Array(N).fill(NaN);
  r.margin = new Float64Array(N).fill(NaN); r.win2 = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const row = r.m[i];
    if (!row) continue;
    r.apt[i] = row[0]; r.comp[i] = row[1]; r.bra[i] = row[2]; r.nul[i] = row[3]; r.valid[i] = row[4];
    let w = -1, wv = -1, s = -1, sv = -1;
    for (let k = 5; k < row.length; k += 2) {
      const ei = row[k], v = row[k + 1];
      if (v > wv) { s = w; sv = wv; w = ei; wv = v; } else if (v > sv) { s = ei; sv = v; }
    }
    if (w >= 0 && row[4] > 0) {
      r.win[i] = w; r.win2[i] = s; r.winShare[i] = wv / row[4] * 100;
      r.margin[i] = (wv - Math.max(sv, 0)) / row[4] * 100;
    }
  }
  return r;
}

export async function loadLocais(uf) {
  if (!S.locais[uf]) S.locais[uf] = j(`data/locais/${uf}.json`);
  return S.locais[uf];
}

// ---------- candidatos de deputado (arquivos por UF, sob demanda)
export async function loadChunk(ds, uf) {
  const k = `${ds}_${uf}`;
  if (!S.chunks[k]) {
    S.chunks[k] = j(`data/cand/${fid(k)}.json`).then((c) => {
      c.entIdx = new Map(c.ents.map((e, i) => [e.k, i]));
      const m = new Map(); for (const [i, row] of Object.entries(c.m)) m.set(+i, row);
      c.rows = m; c.loaded = true; S.chunks[k] = c; return c;
    });
  }
  return S.chunks[k];
}
export const chunkOf = (ds, uf) => { const c = S.chunks[`${ds}_${uf}`]; return c && c.loaded ? c : null; };
// procura um candidato (que não está no índice de busca, ex.: vereador) entre os arquivos já carregados
export function findInChunks(ds, key) {
  for (const [k, c] of Object.entries(S.chunks)) {
    if (!c.loaded || !k.startsWith(ds + "_")) continue;
    const ci = c.entIdx.get(key); if (ci !== undefined) return { c, ci, uf: k.slice(ds.length + 1) };
  }
  return null;
}

// garante que todas as variáveis citadas estejam disponíveis (carrega os arquivos necessários)
export async function ensureVars(ids) {
  const jobs = [];
  for (const id of ids) {
    if (!id) continue;
    const p = id.split("|");
    if (p[0] !== "s") continue;
    const r = S.ds[p[1]]; if (!r || r.entIdx.has(p[2])) continue;
    const uf = S.candUF.get(`${p[1]}|${p[2]}`); if (uf) jobs.push(loadChunk(p[1], uf));
  }
  await Promise.all(jobs);
}

// ---------- cores dos partidos
const PCOR = { PT:"#d62839", PL:"#2d5fd0", PSD:"#f2a900", MDB:"#12a37f", "UNIÃO":"#0b79b8", UNIAO:"#0b79b8",
  PP:"#5a6fc9", PSB:"#f26a21", PDT:"#c04a6b", PSDB:"#2a9fd6", REPUBLICANOS:"#1d9bb5", PODE:"#3fa66b", PSOL:"#a31d6b",
  PCDOB:"#b2182b", "PC do B":"#b2182b", PV:"#4fa831", REDE:"#2c9c6f", CIDADANIA:"#9a6bd0", SOLIDARIEDADE:"#e28a00",
  PRD:"#6e7a8a", AVANTE:"#17b0a7", AGIR:"#8c6d46", MOBILIZA:"#b86c2f", PRTB:"#566a2e", NOVO:"#f48b29", DC:"#7a8d3c",
  MISSÃO:"#ffb400", MISSAO:"#ffb400", UP:"#8b0000", PSTU:"#7f0f2e", PCB:"#a50021", PCO:"#a50021", DEMOCRATA:"#6c8a96",
  PMB:"#5f8f4a", PATRIOTA:"#6b9a30" };
function hashColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360},55%,52%)`; }
export const partyColor = (p) => PCOR[(p || "").toUpperCase()] || PCOR[p] || hashColor(p || "?");
export const photoUrl = (key) => key && key[0] === "c" ? `fotos/${key.slice(1)}.jpg` : null;

// ---------- variáveis
const vcache = new Map();
const lab = (e) => e.t === "p" ? e.n : e.n + (e.u ? ` (${e.p}-${e.u})` : ` (${e.p})`);
export const dsLabel = (id) => S.index.find((d) => d.id === id)?.label || id;

export function entInfo(ds, key) {
  const r = S.ds[ds]; if (!r) return null;
  const i = r.entIdx.get(key); if (i !== undefined) return r.ents[i];
  const uf = S.candUF.get(`${ds}|${key}`); const c = uf && chunkOf(ds, uf);
  if (c) { const ci = c.entIdx.get(key); if (ci !== undefined) return c.ents[ci]; }
  const f = findInChunks(ds, key); if (f) return f.c.ents[f.ci];
  const x = S.cands.find((q) => q[0] === ds && "c" + q[2] === key);
  return x ? { k: key, n: x[3], p: x[4], nr: x[5], u: x[1] || null, t: "c", tot: x[6], el: !!x[7] } : null;
}

export function varGroups() {
  const groups = [];
  for (const d of S.index) {
    const r = S.ds[d.id];
    const items = r.ents.map((e) => ({ id: `s|${d.id}|${e.k}`, label: lab(e), uf: e.u, party: e.t === "p" }));
    groups.push({ id: "res:" + d.id, label: `Resultado — ${d.label}`, items, ds: d.id });
  }
  const part = [];
  for (const d of S.index) {
    part.push({ id: `t|${d.id}`, label: `Comparecimento — ${d.label}` });
    part.push({ id: `a|${d.id}`, label: `Abstenção — ${d.label}` });
    part.push({ id: `bn|${d.id}`, label: `Brancos+nulos — ${d.label}` });
    part.push({ id: `mg|${d.id}`, label: `Margem do 1º sobre o 2º — ${d.label}` });
  }
  groups.push({ id: "part", label: "Participação e competitividade", items: part });
  const dg = {};
  for (const v of S.demo.vars) (dg[v.group] ||= []).push({ id: "d|" + v.id, label: v.label });
  for (const [g, items] of Object.entries(dg)) groups.push({ id: "demo:" + g, label: "TSE · " + g, items });
  groups.push({ id: "emendas", label: "Emendas parlamentares (por autor)", items: S.em.authors.map((a, i) => ({ id: "e|" + i, label: `${a.n}${a.uf ? " (" + a.uf + ")" : ""} — emendas recebidas` }))
    .filter((x, i) => S.em.m[i]).sort((x, y) => x.label.localeCompare(y.label)) });
  const ig = {};
  for (const v of S.ibgeD.vars) (ig[v.group] ||= []).push({ id: "i|" + v.id, label: v.label });
  for (const [g, items] of Object.entries(ig)) groups.push({ id: "ibge:" + g, label: g, items });
  return groups;
}

export function getVar(id) {
  if (vcache.has(id)) return vcache.get(id);
  const p = id.split("|");
  const N = S.N, a = new Float64Array(N).fill(NaN);
  let label = id, unit = "%";
  if (p[0] === "s") {
    const r = S.ds[p[1]]; if (!r) return null;
    const ei = r.entIdx.get(p[2]);
    if (ei !== undefined) {
      const e = r.ents[ei]; label = `${lab(e)} — ${dsLabel(p[1])}`;
      for (let i = 0; i < N; i++) {
        const row = r.m[i]; if (!row) continue;
        let v = 0;
        for (let k = 5; k < row.length; k += 2) if (row[k] === ei) { v = row[k + 1]; break; }
        if (e.u && S.uf[i] !== e.u) continue;           // governador/senador: só dentro do estado
        if (row[4] > 0) a[i] = v / row[4] * 100;
      }
    } else {                                              // candidato a deputado (arquivo por UF)
      let uf = S.candUF.get(`${p[1]}|${p[2]}`), c = uf && chunkOf(p[1], uf);
      if (!c) { const f = findInChunks(p[1], p[2]); if (f) { c = f.c; uf = f.uf; } }
      if (!c) return null;                                // ainda não carregado -> use ensureVars()
      const e = c.ents[c.entIdx.get(p[2])]; label = `${lab(e)} — ${dsLabel(p[1])}`;
      const ci = c.entIdx.get(p[2]);
      for (let i = 0; i < N; i++) {
        if (S.uf[i] !== uf || !(r.valid[i] > 0)) continue;
        const row = c.rows.get(i); let v = 0;
        if (row) for (let k = 0; k < row.length; k += 2) if (row[k] === ci) { v = row[k + 1]; break; }
        a[i] = v / r.valid[i] * 100;
      }
    }
  } else if (p[0] === "t" || p[0] === "a" || p[0] === "bn" || p[0] === "mg") {
    const r = S.ds[p[1]];
    const nm = { t: "Comparecimento", a: "Abstenção", bn: "Brancos+nulos", mg: "Margem do 1º sobre o 2º" }[p[0]];
    label = `${nm} — ${dsLabel(p[1])}`;
    for (let i = 0; i < N; i++) {
      if (!r.m[i] || !(r.apt[i] > 0)) continue;
      if (p[0] === "t") a[i] = r.comp[i] / r.apt[i] * 100;
      else if (p[0] === "a") a[i] = (1 - r.comp[i] / r.apt[i]) * 100;
      else if (p[0] === "bn") a[i] = r.comp[i] > 0 ? (r.bra[i] + r.nul[i]) / r.comp[i] * 100 : NaN;
      else a[i] = r.margin[i];
    }
    if (p[0] === "mg") unit = "pp";
  } else if (p[0] === "e") {
    const ai = +p[1], au = S.em.authors[ai]; if (!au) return null;
    label = `${au.n} — emendas parlamentares recebidas (R$)`; unit = "R$"; a.fill(0);
    for (const [mi, v] of S.em.m[ai] || []) a[mi] = v;
  } else if (p[0] === "d" || p[0] === "i") {
    const src = p[0] === "d" ? S.demo : S.ibgeD;
    const v = src.vars.find((x) => x.id === p[1]); if (!v) return null;
    label = v.label; const arr = src.v[p[1]];
    for (let i = 0; i < N; i++) a[i] = arr[i] == null ? NaN : arr[i];
    unit = unitOf(p[0], p[1]);
  } else return null;
  const out = { id, arr: a, label, unit };
  vcache.set(id, out);
  return out;
}

const UNIT_N = new Set(["d|elei", "i|pop", "i|dens", "i|renda_pc", "i|renda_pc_med", "i|renda_trab", "i|pibpc", "i|idade_med", "i|envel", "i|cresc",
  "i|logpop", "i|logdens", "i|logpibpc", "i|salario_sm", "i|empregos", "i|emprego_formal", "i|empresas"]);
function unitOf(src, id) {
  const k = `${src}|${id}`;
  if (!UNIT_N.has(k)) return "%";
  if (["i|renda_pc", "i|renda_pc_med", "i|renda_trab", "i|pibpc"].includes(k)) return "R$";
  return "n";
}

export const eleitorado = () => getVar("d|elei").arr;
export const fmt = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtMoney = (v) => (v == null || !isFinite(v)) ? "—" : Math.abs(v) >= 1e9 ? `R$ ${fmt(v / 1e9, 2)} bi` : Math.abs(v) >= 1e6 ? `R$ ${fmt(v / 1e6, 1)} mi` : Math.abs(v) >= 1e3 ? `R$ ${fmt(v / 1e3, 0)} mil` : `R$ ${fmt(v, 0)}`;
export const fmtInt =(v) => (v == null || !isFinite(v)) ? "—" : Math.round(v).toLocaleString("pt-BR");
export const fmtVal = (v, unit) => unit === "n" ? fmt(v, Math.abs(v) >= 100 ? 0 : 2) : unit === "R$" ? (Math.abs(v) >= 1e4 ? fmtMoney(v) : "R$ " + fmtInt(v)) : unit === "pp" ? fmt(v) + " pp" : fmt(v) + "%";

export function scopeIdx(uf) {
  const out = [];
  for (let i = 0; i < S.N; i++) if (!uf || S.uf[i] === uf) out.push(i);
  return out;
}
