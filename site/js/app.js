import { S, parseDs, dsId, loadAll, loadLocais, loadChunk, chunkOf, ensureVars, getVar, varGroups, partyColor, photoUrl, entInfo, dsLabel,
  fmt, fmtInt, fmtVal, fmtMoney, scopeIdx, eleitorado, UF_NOME, REGIAO, REGIAO_COR } from "./data.js";
import { pearson, spearman, pValue, describe, percentile, take } from "./stats.js";
import { Scatter, renderMatrix, mix } from "./charts.js";

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
};
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (t) => Math.max(0, Math.min(1, t));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const normS = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CARGO_N = { pres: "Presidente", gov: "Governador", sen: "Senador", dfed: "Dep. Federal", dest: "Dep. Estadual", ddist: "Dep. Distrital", pref: "Prefeito", vere: "Vereador" };
// anos e cargos disponíveis são derivados do índice de dados (preenchidos em buildYears() após o carregamento)
let CARGOS_YEAR = {}, ELEICOES = [];
function buildYears() {
  const ord = ["pres", "gov", "sen", "dfed", "dest", "ddist", "pref", "vere"];
  CARGOS_YEAR = {};
  for (const d of S.index) { const y = d.year || 2026; (CARGOS_YEAR[y] ||= []); if (!CARGOS_YEAR[y].includes(d.cc)) CARGOS_YEAR[y].push(d.cc); }
  for (const y in CARGOS_YEAR) CARGOS_YEAR[y].sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
  ELEICOES = Object.keys(CARGOS_YEAR).map(Number).sort((a, b) => b - a)
    .map((y) => [y, `${y} — ${CARGOS_YEAR[y].some((c) => c === "pref" || c === "vere") ? "Municipal" : "Federal e estadual"}`]);
}
const ccOf = (ds) => parseDs(ds).cc, turnoOf = (ds) => parseDs(ds).turno, yearOf = (ds) => parseDs(ds).year;

// ---------------------------------------------------------------- estado
const D = { tab: "map", ds: "pres1", mode: "winner", v: "", vB: "", uf: "", x: "", y: "", wt: 1, minE: 0, bub: 0,
  sel: -1, locT: 1, locMode: "local", locColor: "win", mx: [], rk: 10000, nb: 0, dp: "" };
const state = JSON.parse(JSON.stringify(D));
let hashT;
function saveHash() {
  clearTimeout(hashT);
  hashT = setTimeout(() => {
    const o = {}; for (const k in D) if (JSON.stringify(state[k]) !== JSON.stringify(D[k])) o[k] = state[k];
    try { history.replaceState(null, "", Object.keys(o).length ? "#" + encodeURIComponent(JSON.stringify(o)) : location.pathname); } catch {}
  }, 250);
}
function loadHash() {
  try { const o = JSON.parse(decodeURIComponent(location.hash.slice(1) || "{}")); for (const k in o) if (k in D) state[k] = o[k]; } catch {}
}
const inScope = (i) => !state.uf || S.uf[i] === state.uf;
const neutral = () => css("--neutral");
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

// ---------------------------------------------------------------- cores
const RAMP = ["#2b0a3d", "#7a1f5c", "#c8384a", "#f37a2c", "#fbc02d", "#fff3a0"];
function seqColor(t) { t = clamp(t); const k = t * (RAMP.length - 1), i = Math.min(Math.floor(k), RAMP.length - 2); return mix(RAMP[i], RAMP[i + 1], k - i); }
const DIV_NEG = "#d6453d", DIV_POS = "#2f6fd6";
function divColor(t) { t = Math.max(-1, Math.min(1, t)); return t >= 0 ? mix(neutral(), DIV_POS, t) : mix(neutral(), DIV_NEG, -t); }
// degradê de um candidato: do neutro à cor do partido
// três paradas (escuro → cor do partido → claro) para dar contraste real ao degradê
function candRamp(color) {
  const dark = isDark();
  const a = dark ? mix(color, "#0b0c0e", 0.9) : mix(color, "#ffffff", 0.9);
  const c = dark ? mix(color, "#ffffff", 0.88) : mix(color, "#000000", 0.5);
  return (t) => { t = clamp(t); return t < 0.5 ? mix(a, color, t / 0.5) : mix(color, c, (t - 0.5) / 0.5); };
}

// ---------------------------------------------------------------- tooltip
const tip = $("#tip");
function showTip(html, e) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + hh > innerHeight - 8) y = e.clientY - hh - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => { tip.hidden = true; };

// ---------------------------------------------------------------- mapa
let map, bbox = [], ufBox = {};
let curMetric = null, residual = null, autoBase = false;

function geomBox(g) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (c) => { if (typeof c[0] === "number") { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; } else c.forEach(walk); };
  walk(g.coordinates); return [x0, y0, x1, y1];
}
const mobile = () => innerWidth <= 900;
const mapPad = () => mobile() ? { top: 70, left: 20, right: 20, bottom: innerHeight * 0.55 } : { top: 110, left: 450, right: 60, bottom: 40 };
function fit(b, opts = {}) { map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: mapPad(), duration: 700, maxZoom: 13, ...opts }); }
const baseRasterPaint = () => isDark()
  ? { "raster-brightness-max": 0.32, "raster-saturation": -0.7, "raster-contrast": 0.1 }
  : { "raster-brightness-max": 1, "raster-saturation": -0.5, "raster-contrast": 0 };
const fillOpacity = () => ["case", ["boolean", ["feature-state", "dim"], false], 0.06, state.base ? 0.55 : 0.92];

async function initMap() {
  map = new maplibregl.Map({ container: "map", center: [-53, -14.5], zoom: 3.5, minZoom: 2.5, maxZoom: 17,
    attributionControl: { compact: true },
    style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": css("--bg") } }] } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  const loadedP = new Promise((r) => map.on("load", r));
  new ResizeObserver(() => map.resize()).observe($("#map"));
  requestAnimationFrame(() => map.resize());
  const [mun, uf] = await Promise.all([fetch("data/mun.geojson").then((r) => r.json()), fetch("data/uf.geojson").then((r) => r.json())]);
  bbox = new Array(S.N);
  for (const f of mun.features) { const i = S.idx.get(f.properties.c); if (i != null) bbox[i] = geomBox(f.geometry); }
  for (const f of uf.features) ufBox[f.properties.uf] = geomBox(f.geometry);
  await loadedP;
  map.addSource("base", { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors", maxzoom: 19 });
  map.addLayer({ id: "base", type: "raster", source: "base", layout: { visibility: "none" }, paint: baseRasterPaint() });
  map.addSource("mun", { type: "geojson", data: mun, promoteId: "c" });
  map.addSource("uf", { type: "geojson", data: uf });
  map.addLayer({ id: "mun-fill", type: "fill", source: "mun", paint: { "fill-color": ["coalesce", ["feature-state", "color"], neutral()], "fill-opacity": fillOpacity() } });
  map.addLayer({ id: "mun-line", type: "line", source: "mun", paint: lineStyle() });
  map.addLayer({ id: "uf-line", type: "line", source: "uf", paint: { "line-color": css("--text"), "line-opacity": 0.5, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.4] } });
  map.addSource("locais", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "locais-c", type: "circle", source: "locais", paint: {
    "circle-color": ["get", "color"], "circle-opacity": 0.9, "circle-stroke-color": css("--panel"), "circle-stroke-width": 0.8,
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, ["*", ["get", "r"], 0.5], 12, ["*", ["get", "r"], 1.1], 16, ["*", ["get", "r"], 2.2]] } });

  map.on("mousemove", (e) => {
    const lf = map.queryRenderedFeatures(e.point, { layers: ["locais-c"] })[0];
    if (lf) { map.getCanvas().style.cursor = "pointer"; showTip(locTip(lf.properties.k), e.originalEvent); return; }
    const f = map.queryRenderedFeatures(e.point, { layers: ["mun-fill"] })[0];
    if (!f) { map.getCanvas().style.cursor = ""; hideTip(); return; }
    map.getCanvas().style.cursor = "pointer";
    const i = S.idx.get(f.properties.c); if (i == null) return;
    showTip(munTip(i), e.originalEvent);
  });
  map.on("mouseout", hideTip);
  map.on("click", (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["mun-fill"] })[0];
    if (!f) return; const i = S.idx.get(f.properties.c); if (i != null) select(i, false);
  });
  await new Promise((r) => map.once("idle", r));
}
function lineStyle() {
  return { "line-color": ["case", ["boolean", ["feature-state", "sel"], false], css("--text"), ["boolean", ["feature-state", "hl"], false], css("--accent"), css("--line")],
    "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.6, ["boolean", ["feature-state", "hl"], false], 1.6, 0.25],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.35, 8, 0.9] };
}

function munTip(i) {
  const extra = curMetric && curMetric.tip ? curMetric.tip(i) : "";
  return `<b>${esc(S.nome[i])} <span class="muted">· ${S.uf[i]}</span></b>${extra}`;
}
function setStates() {
  const m = curMetric; if (!m || !map) return;
  for (let i = 0; i < S.N; i++) map.setFeatureState({ source: "mun", id: S.ibge[i] }, { color: m.colors[i], dim: !inScope(i) });
}
let hlSet = new Set();
function setHighlight(ids) {
  for (const i of hlSet) map.setFeatureState({ source: "mun", id: S.ibge[i] }, { hl: false });
  hlSet = new Set(ids || []);
  for (const i of hlSet) map.setFeatureState({ source: "mun", id: S.ibge[i] }, { hl: true });
}
let lastSel = -1;
function setSelState() {
  if (!map) return;
  if (lastSel >= 0) map.setFeatureState({ source: "mun", id: S.ibge[lastSel] }, { sel: false });
  if (state.sel >= 0) map.setFeatureState({ source: "mun", id: S.ibge[state.sel] }, { sel: true });
  lastSel = state.sel;
}
function flyScope() {
  if (!map) return;
  if (state.uf && ufBox[state.uf]) fit(ufBox[state.uf]); else fit([-74, -33.8, -34.8, 5.3], { maxZoom: 5 });
}

// ---------------------------------------------------------------- métricas do mapa
function scalar(arr, unit, label, kind, nameFn, ramp) {
  const idx = scopeIdx(state.uf).filter((i) => isFinite(arr[i]));
  const vals = idx.map((i) => arr[i]);
  let lo = percentile(vals, 0.02), hi = percentile(vals, 0.98);
  const diverge = kind === "div";
  if (diverge) { const mx = Math.max(Math.abs(lo), Math.abs(hi)) || 1; lo = -mx; hi = mx; }
  if (!(hi > lo)) hi = lo + 1;
  const colors = new Array(S.N).fill(null);
  const rp = ramp || seqColor;
  let mid = NaN;
  if (kind === "cand") {
    // escala por quantis: cada faixa de municípios recebe uma cor distinta, mesmo com distribuição muito assimétrica
    const sorted = Float64Array.from(vals).sort(); const n = sorted.length;
    lo = sorted[0]; mid = sorted[Math.floor(n / 2)]; hi = sorted[n - 1];
    const rank = (v) => { let a = 0, b = n; while (a < b) { const m = (a + b) >> 1; if (sorted[m] < v) a = m + 1; else b = m; } return n > 1 ? a / (n - 1) : 0.5; };
    for (const i of idx) colors[i] = rp(rank(arr[i]));
  } else for (const i of idx) colors[i] = diverge ? divColor(arr[i] / hi) : rp((arr[i] - lo) / (hi - lo));
  return { kind, colors, lo, mid, hi, unit, label, arr, idx, ramp: rp,
    tip: (i) => isFinite(arr[i]) ? `<div>${esc(label)}</div><b style="font-family:var(--mono)">${fmtVal(arr[i], unit)}</b>` + (nameFn ? nameFn(i) : "") : `<div class="muted">Sem dado</div>` };
}

// candidato selecionado, só se pertencer ao cargo/ano exibido na lista
const curEnt = () => { const eo = entOfVar(state.v); if (!eo) return null; const a = parseDs(eo.ds), b = parseDs(state.ds); return a.cc === b.cc && a.year === b.year ? eo : null; };
const linkOf = () => { const eo = curEnt(); return eo ? S.em.links[`${eo.ds}|${eo.key}`] : undefined; };
let _rev = null;
const candOfAuthor = (ai) => { if (!_rev) { _rev = new Map(); for (const [k, a] of Object.entries(S.em.links)) _rev.set(a, k); } return _rev.get(ai); };
// mesmo candidato/partido em outro ano (mesmo cargo e turno): casa pelo nome (candidatos) ou sigla (partidos)
function counterpart(ds, key) {
  const { cc, turno, year } = parseDs(ds), e = entInfo(ds, key); if (!e) return null;
  for (const y of Object.keys(CARGOS_YEAR).map(Number).filter((y) => y !== year)) {
    const od = dsId(cc, turno, y), r = S.ds[od]; if (!r) continue;
    const m = r.ents.find((x) => x.t === e.t && (e.t === "p" ? x.p === e.p : normS(x.n) === normS(e.n)));
    if (m) return { ds: od, key: m.k, year: y };
  }
  return null;
}
function entOfVar(id) { const p = (id || "").split("|"); return p[0] === "s" ? { ds: p[1], key: p[2], e: entInfo(p[1], p[2]) } : null; }

function computeMetric() {
  const N = S.N;
  if (state.mode === "winner") {
    const r = S.ds[state.ds], cap = r.isDep ? 20 : 35;
    const colors = new Array(N).fill(null), counts = new Map(), nz = neutral();
    for (let i = 0; i < N; i++) {
      const w = r.win[i]; if (w < 0) continue;
      if (inScope(i)) counts.set(w, (counts.get(w) || 0) + 1);
      colors[i] = mix(nz, partyColor(r.ents[w].p), 0.3 + 0.7 * clamp(r.margin[i] / cap));
    }
    return { kind: "cat", colors, counts, r,
      tip: (i) => { const w = r.win[i]; if (w < 0) return `<div class="muted">Sem apuração</div>`;
        const e = r.ents[w]; return `<div><span class="sw" style="display:inline-block;background:${partyColor(e.p)}"></span> ${esc(e.n)} <span class="muted">${e.t === "c" ? e.p : ""}</span></div><b style="font-family:var(--mono)">${fmt(r.winShare[i])}%</b> <span class="muted">· margem ${fmt(r.margin[i])} pp</span>`; } };
  }
  if (state.mode === "var") {
    const v = getVar(state.v); if (!v) return null;
    const eo = entOfVar(state.v);
    if (eo && eo.e) return scalar(v.arr, v.unit, v.label, "cand", null, candRamp(partyColor(eo.e.p)));
    return scalar(v.arr, v.unit, v.label, "seq");
  }
  if (state.mode === "emenda") {
    const ai = linkOf(), eo = entOfVar(state.v); if (ai == null || !eo) return null;
    const v = getVar("e|" + ai); return scalar(v.arr, "R$", v.label, "cand", null, candRamp(partyColor(eo.e.p)));
  }
  if (state.mode === "diff") {
    const a = getVar(state.v), b = getVar(state.vB); if (!a || !b) return null;
    const d = new Float64Array(N); for (let i = 0; i < N; i++) d[i] = a.arr[i] - b.arr[i];
    return scalar(d, "pp", `Variação: ${a.label.replace(/ — .*$/, "")} · ${dsLabel(state.v.split("|")[1])} − ${dsLabel(state.vB.split("|")[1])}`, "div", (i) => `<div class="muted">${fmt(a.arr[i])}% − ${fmt(b.arr[i])}%</div>`);
  }
  if (state.mode === "resid") {
    if (!residual) return null;
    return scalar(residual.arr, "pp", residual.label, "div", (i) => `<div class="muted">observado ${fmt(residual.y[i])} · esperado ${fmt(residual.y[i] - residual.arr[i])}</div>`);
  }
  return null;
}

function renderMapCard() {
  const box = $("#mapcard"); box.innerHTML = ""; const m = curMetric;
  if (!m) { box.hidden = true; return; }
  box.hidden = false;
  if (m.kind === "cat") {
    const rows = [...m.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    box.append(h("div", { class: "muted mono", style: "font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px" }, `Vencedor por município${state.uf ? " · " + state.uf : ""}`));
    for (const [w, n] of rows) {
      const e = m.r.ents[w];
      box.append(h("button", { class: "lg-row", title: "Ver o degradê deste candidato/partido", onclick: () => pickEntity(state.ds, e.k) },
        h("i", { class: "sw", style: `background:${partyColor(e.p)}` }), e.n, h("span", { class: "n" }, fmtInt(n))));
    }
    box.append(h("div", { class: "warn" }, "Cor mais forte = maior margem."));
    return;
  }
  const eo = state.mode === "var" || state.mode === "emenda" ? entOfVar(state.v) : null;
  if (eo && eo.e) {
    const k = eo.key, ph = photoUrl(k);
    box.append(h("div", { class: "hd" }, ph ? h("img", { src: ph, alt: "", onerror: (ev) => ev.target.replaceWith(h("div", { class: "ph" })) }) : h("div", { class: "ph" }),
      h("div", {}, h("b", {}, eo.e.n), h("small", {}, `${eo.e.p}${eo.e.u ? " · " + eo.e.u : ""} · ${state.mode === "emenda" ? "emendas recebidas por município" : dsLabel(eo.ds)}`)),
      h("button", { class: "x", title: "Voltar ao vencedor", onclick: () => { state.mode = "winner"; refresh(); } }, "×")));
  } else {
    box.append(h("div", { class: "hd" }, h("div", {}, h("b", {}, m.label.length > 90 ? m.label.slice(0, 88) + "…" : m.label)),
      h("button", { class: "x", title: "Voltar ao vencedor", onclick: () => { state.mode = "winner"; refresh(); } }, "×")));
  }
  const grad = m.kind === "div" ? `linear-gradient(90deg,${DIV_NEG},${neutral()},${DIV_POS})`
    : m.kind === "cand" ? `linear-gradient(90deg,${m.ramp(0)},${m.ramp(0.25)},${m.ramp(0.5)},${m.ramp(0.75)},${m.ramp(1)})` : `linear-gradient(90deg,${RAMP.join(",")})`;
  box.append(h("div", { class: "grad", style: `background:${grad};margin-top:10px;height:12px` }),
    h("div", { class: "gl" }, h("span", {}, fmtVal(m.lo, m.unit)), m.kind === "div" ? h("span", {}, "0") : m.kind === "cand" ? h("span", {}, `mediana ${fmtVal(m.mid, m.unit)}`) : "", h("span", {}, fmtVal(m.kind === "cand" ? m.max ?? m.hi : m.hi, m.unit))),
    h("div", { class: "warn" }, m.kind === "cand" ? (state.mode === "emenda" ? "Valor das emendas individuais recebido por favorecidos em cada município. Escala por quantis." : "% dos votos válidos em cada município. Escala por quantis: cada cor representa a mesma fração de municípios.") : "Escala entre os percentis 2 e 98 dos municípios exibidos."));
}

// ---------------------------------------------------------------- chips do mapa
function renderChips() {
  const host = $("#chips"); host.innerHTML = "";
  const eo = state.mode === "var" ? entOfVar(state.v) : state.mode === "diff" ? entOfVar(state.v) : null;
  const other = (ds) => { const cc = ccOf(ds), t = turnoOf(ds), od = cc + (t === 1 ? 2 : 1); return S.ds[od] ? od : null; };
  const cur = curEnt();
  const curY = cur ? yearOf(cur.ds) : 2026, curCc = cur ? ccOf(cur.ds) : "";
  const d1 = dsId(curCc, 1, curY), d2 = dsId(curCc, 2, curY);
  const hasBoth = cur && cur.e && !S.ds[cur.ds].isDep && S.ds[d1] && S.ds[d2] && S.ds[d2].entIdx.has(cur.key) && S.ds[d1].entIdx.has(cur.key);
  const cp = cur && cur.e ? counterpart(cur.ds, cur.key) : null;
  const chip = (t, on, fn, dis, title) => host.append(h("button", { class: "chip-m" + (on ? " on" : ""), disabled: dis, title, onclick: fn }, t));
  chip("Vencedor", state.mode === "winner", () => { state.mode = "winner"; refresh(); });
  chip("Degradê", state.mode === "var", () => { if (cur) { state.mode = "var"; refresh(); } }, !cur, cur ? "" : "Clique em um candidato na lista");
  const hasEm = linkOf() != null;
  chip("Emendas", state.mode === "emenda", () => { if (hasEm) { state.mode = "emenda"; refresh(); } }, !hasEm, hasEm ? "Onde este parlamentar enviou emendas individuais" : "Disponível para deputados e senadores com emendas individuais");
  chip("1º × 2º turno", state.mode === "diff", () => {
    state.mode = "diff"; state.v = `s|${d2}|${cur.key}`; state.vB = `s|${d1}|${cur.key}`; refresh();
  }, !hasBoth, hasBoth ? "Variação do voto neste candidato do 1º para o 2º turno" : "Disponível para candidatos que disputaram os dois turnos");
  chip(cp ? `Variação vs ${cp.year}` : "Variação entre anos", state.mode === "diff" && state.vB && state.v && yearOf(state.v.split("|")[1]) !== yearOf(state.vB.split("|")[1]), () => {
    state.mode = "diff"; state.v = `s|${cur.ds}|${cur.key}`; state.vB = `s|${cp.ds}|${cp.key}`; refresh();
  }, !cp, cp ? `Diferença entre ${curY} e ${cp.year} para ${cur.e.n}` : "Disponível para quem aparece em mais de uma eleição (ex.: Lula 2022 × 2026)");
}

// ---------------------------------------------------------------- seletor de variável (com busca de candidato)
let GROUPS = [];
const pickers = [];
function picker(get, set, opts = {}) {
  const gsel = h("select", { "aria-label": "Categoria" }), isel = h("select", { "aria-label": "Variável" });
  GROUPS.forEach((g) => gsel.append(h("option", { value: g.id }, g.label)));
  const fill = (gid) => {
    isel.innerHTML = ""; const g = GROUPS.find((x) => x.id === gid); if (!g) return;
    const parties = g.items.filter((i) => i.party), rest = g.items.filter((i) => !i.party);
    parties.forEach((i) => isel.append(h("option", { value: i.id }, i.label)));
    const byUf = new Map();
    rest.forEach((i) => { const k = i.uf || ""; if (!byUf.has(k)) byUf.set(k, []); byUf.get(k).push(i); });
    for (const [uf, its] of byUf) {
      if (!uf) its.forEach((i) => isel.append(h("option", { value: i.id }, i.label)));
      else { const og = h("optgroup", { label: UF_NOME[uf] || uf }); its.forEach((i) => og.append(h("option", { value: i.id }, i.label))); isel.append(og); }
    }
  };
  const apply = async (id) => { await ensureVars([id]); set(id); };
  gsel.onchange = () => { fill(gsel.value); apply(isel.value); };
  isel.onchange = () => apply(isel.value);
  const search = candSearch((c) => apply(`s|${c[0]}|c${c[2]}`), "Ou busque um candidato…");
  const el = h("div", { class: "pick" }, gsel, isel, search);
  const sync = () => {
    const id = get(); if (!id) return;
    const g = GROUPS.find((x) => x.items.some((i) => i.id === id));
    if (g) { if (gsel.value !== g.id || !isel.options.length) { gsel.value = g.id; fill(g.id); } isel.value = id; }
  };
  if (!opts.noReg) pickers.push(sync);
  fill(GROUPS[0].id); sync();
  return el;
}
const syncPickers = () => pickers.forEach((f) => f());

// busca de candidatos (índice com todos os candidatos de todos os cargos)
let candNorm = null;
function candMatches(q, limit = 8) {
  if (!candNorm) candNorm = S.cands.map((c) => normS(c[3]));
  const v = normS(q.trim()); if (v.length < 2) return [];
  const parts = v.split(/\s+/), out = [];
  for (let i = 0; i < candNorm.length; i++) {
    const n = candNorm[i]; if (!parts.every((p) => n.includes(p))) continue;
    out.push([n.startsWith(v) ? 0 : n.includes(" " + v) ? 1 : 2, -S.cands[i][6], i]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out.slice(0, limit).map((x) => S.cands[x[2]]);
}
function candRow(c, onclick) {
  const sd = S.index.find((d) => d.id === c[0]);
  return h("button", { class: "qr", onclick },
    h("img", { src: `fotos/${c[2]}.jpg`, alt: "", loading: "lazy", onerror: (ev) => ev.target.replaceWith(h("div", { class: "ph" })) }),
    h("div", { class: "t" }, h("b", {}, c[3]), h("small", {}, `${c[4]} · ${sd.cargo} ${sd.year}${sd.turno === 2 ? " 2º turno" : ""}${c[8] != null ? " · " + S.nome[c[8]] : ""}${c[1] ? " · " + c[1] : ""}`)),
    h("span", { class: "v" }, fmtInt(c[6])));
}
function candSearch(onPick, placeholder) {
  const inp = h("input", { type: "search", placeholder, autocomplete: "off" }), res = h("div", { class: "pick", style: "gap:0" });
  inp.oninput = () => {
    res.innerHTML = ""; const m = candMatches(inp.value, 6);
    m.forEach((c) => res.append(candRow(c, () => { inp.value = ""; res.innerHTML = ""; onPick(c); })));
  };
  return h("div", {}, inp, res);
}

// ---------------------------------------------------------------- aba Resultados
const photoEl = (e) => {
  if (e.t === "p") return h("div", { class: "ph", style: `background:${partyColor(e.p)};color:#fff;font-size:11px` }, e.n.slice(0, 6));
  const ph = photoUrl(e.k);
  return h("img", { class: "ph", src: ph, alt: e.n, loading: "lazy", onerror: (ev) => ev.target.replaceWith(h("div", { class: "ph" }, (e.n.match(/\b\p{L}/gu) || []).slice(0, 2).join("").toUpperCase())) });
};
function candCard(ds, e, votes, total, onClick, on, extra) {
  const share = total > 0 ? votes / total * 100 : 0, cc = ccOf(ds), t = turnoOf(ds);
  const tags = [];
  if (e.t === "c") tags.push(h("span", { class: "tag p", style: `background:${partyColor(e.p)}` }, e.p));
  if (e.el) tags.push(h("span", { class: "tag o" }, "Eleito"));
  else if (t === 1 && !S.ds[ds].isDep && S.ds[dsId(cc, 2, yearOf(ds))] && S.ds[dsId(cc, 2, yearOf(ds))].entIdx.has(e.k)) tags.push(h("span", { class: "tag o" }, "2º turno"));
  if (extra) tags.push(extra);
  if (e.nr && e.t === "c") tags.push(h("span", { class: "tag g" }, e.nr));
  const ai = S.em.links[`${ds}|${e.k}`];
  if (ai != null) tags.push(h("span", { class: "tag g", title: "Emendas individuais empenhadas (2015–2026)" }, "Emendas " + fmtMoney(S.em.authors[ai].emp)));
  return h("button", { class: "cand" + (on ? " on" : ""), onclick: onClick, "data-k": e.k },
    photoEl(e), h("div", { class: "nm" }, e.n), h("div", { class: "tags" }, tags),
    h("div", { class: "big" }, h("b", {}, fmt(share, share < 10 ? 2 : 1), h("small", {}, "%")), h("span", {}, fmtInt(votes))),
    h("div", { class: "bar" }, h("i", { style: `width:${Math.min(100, share)}%;background:${partyColor(e.p)}` }), S.ds[ds].isDep ? null : h("u")));
}

let resToken = 0, shown = 40, cq = "";
async function renderResults() {
  const host = $("#tab-map"), tok = ++resToken;
  const r = S.ds[state.ds], cc = ccOf(state.ds), i0 = state.sel;
  host.innerHTML = "";
  const scopeLabel = i0 >= 0 ? `${S.nome[i0]} · ${S.uf[i0]}` : state.uf ? UF_NOME[state.uf] : "Nacional";
  host.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Resultados"),
    h("span", { class: "scope" }, scopeLabel, i0 >= 0 ? h("button", { title: "Voltar", onclick: () => { select(-1); } }, "×") : null)));
  // cargo e turno
  const yr = yearOf(state.ds);
  host.append(h("div", { class: "pills" }, CARGOS_YEAR[yr].filter((c) => S.ds[dsId(c, 1, yr)]).map((c) =>
    h("button", { class: "pill" + (cc === c ? " on" : ""), onclick: () => setDs(dsId(c, 1, yr)) }, CARGO_N[c]))));
  host.append(h("div", { class: "pills" }, [1, 2].map((t) => {
    const id = dsId(cc, t, yr); return h("button", { class: "pill sm" + (turnoOf(state.ds) === t ? " on" : ""), disabled: !S.ds[id], onclick: () => setDs(id) }, "T" + t);
  })));
  if (i0 >= 0) host.append(h("h2", { style: "margin-top:12px" }, S.nome[i0]), h("div", { class: "muted mono", style: "font-size:12px" }, `${UF_NOME[S.uf[i0]]} · ${fmtInt(eleitorado()[i0])} eleitores`));

  const ufScope = i0 >= 0 ? S.uf[i0] : state.uf;
  const muniOnly = cc === "pref" || cc === "vere";          // eleição municipal: candidatos só fazem sentido dentro de um município
  const dp = muniOnly ? (i0 >= 0 ? "c" : "p") : state.dp || (ufScope ? "c" : "p");
  const needUF = !muniOnly && !ufScope && (cc === "gov" || cc === "sen" || (r.isDep && dp === "c"));
  if (muniOnly && i0 < 0) host.append(h("div", { class: "note" }, "Mostrando partidos. Clique em um município (no mapa ou na busca) para ver os candidatos a " + CARGO_N[cc].toLowerCase() + " de lá."));
  if (r.isDep && !muniOnly) {
    host.append(h("div", { class: "row" }, h("div", { class: "seg", style: "flex:1" }, [["c", "Candidatos"], ["p", "Partidos"]].map(([k, l]) =>
      h("button", { class: dp === k ? "on" : "", onclick: () => { state.dp = k; shown = 40; renderResults(); saveHash(); } }, l)))));
  }
  const body = h("div"); host.append(body);

  if (needUF) {
    body.append(h("div", { class: "note" }, cc === "gov" || cc === "sen" ? `Selecione um estado para ver os candidatos a ${r.cargo.toLowerCase()}.` : "Selecione um estado para ver os candidatos."),
      h("div", { class: "chips" }, Object.keys(UF_NOME).map((u) => h("button", { class: "chip", onclick: () => setUf(u) }, u))));
  } else {
    body.append(h("div", { class: "muted", style: "padding:20px 0" }, "Carregando…"));
    const data = await listData(ufScope, dp); if (tok !== resToken) return;
    body.innerHTML = "";
    body.append(h("div", { class: "sec", style: "margin-top:14px" }, h("span", { class: "k" }, dp === "p" && r.isDep ? "Partidos" : "Candidatos"),
      h("span", { class: "muted mono", style: "font-size:11px" }, `${fmtInt(data.valid)} votos válidos`)));
    let items = data.items;
    if (r.isDep && dp === "c") {
      const inp = h("input", { type: "search", placeholder: `Filtrar entre ${fmtInt(items.length)} candidatos…`, value: cq, style: "margin-bottom:10px",
        oninput: (e) => { cq = e.target.value; shown = 40; fillList(); } });
      body.append(inp);
    }
    const eai = (state.mode === "var" || state.mode === "emenda") && entOfVar(state.v)?.ds === state.ds ? linkOf() : undefined;
    if (eai != null) body.append(emendasBox(eai));
    const list = h("div", { class: "cands" }); body.append(list);
    const more = h("button", { class: "btn more", onclick: () => { shown += 40; fillList(); } }, "Ver mais"); body.append(more);
    const curKey = (state.mode === "var" || state.mode === "diff") && entOfVar(state.v)?.ds === state.ds ? entOfVar(state.v).key : null;
    const fillList = () => {
      list.innerHTML = "";
      let arr = items; const f = normS(cq.trim());
      if (f && r.isDep && dp === "c") arr = items.filter((x) => normS(x.e.n).includes(f) || String(x.e.nr).startsWith(f));
      if (curKey && !f) { const ix = arr.findIndex((x) => x.e.k === curKey); if (ix >= shown) shown = ix + 1; }
      arr.slice(0, shown).forEach((x) => list.append(candCard(state.ds, x.e, x.votes, data.valid, () => pickEntity(state.ds, x.e.k, true), curKey === x.e.k && (state.mode === "var" || state.mode === "diff"),
        cc === "pref" && x.e.t === "p" && data.wins.get(x.e.k) ? h("span", { class: "tag g" }, `${fmtInt(data.wins.get(x.e.k))} prefeitura${data.wins.get(x.e.k) > 1 ? "s" : ""}`) : null)));
      more.hidden = arr.length <= shown;
      if (!arr.length) list.append(h("div", { class: "muted" }, "Nenhum candidato encontrado."));
    };
    fillList();
    if (curKey) setTimeout(() => $(`.cand[data-k="${curKey}"]`, list)?.scrollIntoView({ block: "nearest" }), 50);
    // nulos e brancos
    host.append(h("label", { class: "check", style: "margin:14px 0 6px" }, h("input", { type: "checkbox", checked: !!state.nb, onchange: (e) => { state.nb = e.target.checked ? 1 : 0; renderResults(); saveHash(); } }), "Mostrar brancos, nulos e abstenção"));
    if (state.nb) {
      const rows = [["Brancos", data.bra, data.comp], ["Nulos", data.nul, data.comp], ["Abstenção", data.apt - data.comp, data.apt]];
      host.append(h("div", { class: "cands" }, rows.map(([n, v, t]) => h("div", { class: "cand slim" }, h("div", { class: "nm" }, n),
        h("div", { class: "big" }, h("b", {}, fmt(t ? v / t * 100 : 0), h("small", {}, "%")), h("span", {}, fmtInt(v))),
        h("div", { class: "bar" }, h("i", { style: `width:${t ? v / t * 100 : 0}%;background:var(--muted)` }))))));
    }
    host.append(h("div", { class: "kv", style: "margin-top:12px" }, h("span", {}, "Comparecimento"), h("b", {}, `${fmt(data.comp / data.apt * 100)}% · ${fmtInt(data.comp)}`)),
      h("div", { class: "kv" }, h("span", {}, "Eleitores aptos"), h("b", {}, fmtInt(data.apt))));
  }
  if (i0 >= 0) munDetail(host, i0);
  // mapa por outra variável + ranking
  host.append(h("h3", {}, "Colorir o mapa por outra variável"),
    picker(() => state.v, (v) => { state.mode = "var"; state.v = v; refresh(); }),
    h("div", { class: "warn" }, "Perfil do eleitorado (TSE), Censo 2022, renda, PIB, saneamento e participação (IBGE) — ou busque qualquer candidato."),
    h("div", { id: "rank-box" }));
  renderRanking();
}

async function listData(ufScope, dp) {
  const r = S.ds[state.ds], i0 = state.sel;
  const idxs = i0 >= 0 ? [i0] : scopeIdx(state.uf);
  let valid = 0, apt = 0, comp = 0, bra = 0, nul = 0;
  for (const i of idxs) { if (!r.m[i]) continue; valid += r.valid[i]; apt += r.apt[i]; comp += r.comp[i]; bra += r.bra[i]; nul += r.nul[i]; }
  let items = [];
  if (r.isDep && dp === "c") {
    const c = await loadChunk(state.ds, ufScope);
    const acc = new Float64Array(c.ents.length);
    for (const i of idxs) { const row = c.rows.get(i); if (row) for (let k = 0; k < row.length; k += 2) acc[row[k]] += row[k + 1]; }
    items = c.ents.map((e, j) => ({ e, votes: acc[j] })).filter((x) => x.votes > 0);
  } else {
    const acc = new Float64Array(r.ents.length);
    for (const i of idxs) { const row = r.m[i]; if (row) for (let k = 5; k < row.length; k += 2) acc[row[k]] += row[k + 1]; }
    items = r.ents.map((e, j) => ({ e, votes: acc[j] })).filter((x) => x.votes > 0 && (!x.e.u || x.e.u === ufScope));
  }
  items.sort((a, b) => b.votes - a.votes);
  const wins = new Map();                       // prefeituras ganhas por partido no território
  if (ccOf(state.ds) === "pref") for (const i of idxs) { const w = r.win[i]; if (w >= 0) wins.set(r.ents[w].k, (wins.get(r.ents[w].k) || 0) + 1); }
  return { items, valid, apt, comp, bra, nul, wins };
}

function emendasBox(ai) {
  const a = S.em.authors[ai], box = h("div", { class: "legend", style: "margin:0 0 12px" });
  box.append(h("div", { class: "sec", style: "margin:0 0 8px" }, h("span", { class: "k" }, "Emendas parlamentares"), h("span", { class: "scope" }, "individuais")),
    h("div", { class: "kv" }, h("span", {}, "Empenhado (2015–2026)"), h("b", {}, fmtMoney(a.emp))),
    h("div", { class: "kv" }, h("span", {}, "Pago (inclui restos a pagar)"), h("b", {}, fmtMoney(a.pago))),
    a.rec ? h("div", { class: "kv" }, h("span", {}, "Recebido por favorecidos nos municípios"), h("b", {}, fmtMoney(a.rec))) : null);
  const yrs = Object.entries(a.y).sort((x, y) => y[0] - x[0]).slice(0, 5);
  if (yrs.length) box.append(h("div", { class: "muted mono", style: "font-size:10.5px;letter-spacing:.1em;margin:10px 0 4px;text-transform:uppercase" }, "Por ano (empenhado)"),
    ...yrs.map(([y, v]) => h("div", { class: "kv" }, h("span", {}, y), h("b", {}, fmtMoney(v[0])))));
  const fs = Object.entries(a.f).slice(0, 4);
  if (fs.length) box.append(h("div", { class: "muted mono", style: "font-size:10.5px;letter-spacing:.1em;margin:10px 0 4px;text-transform:uppercase" }, "Principais áreas"),
    ...fs.map(([f, v]) => h("div", { class: "kv" }, h("span", {}, f), h("b", {}, fmtMoney(v)))));
  const top = (S.em.m[ai] || []).slice().sort((x, y) => y[1] - x[1]).slice(0, 6);
  if (top.length) box.append(h("div", { class: "muted mono", style: "font-size:10.5px;letter-spacing:.1em;margin:10px 0 4px;text-transform:uppercase" }, "Municípios que mais receberam"),
    h("table", { class: "rank" }, top.map(([mi, v]) => h("tr", { onclick: () => select(mi, true) }, h("td", {}, S.nome[mi] + " ", h("span", { class: "muted" }, S.uf[mi])), h("td", {}, fmtMoney(v))))));
  box.append(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn pri", onclick: () => { state.mode = "emenda"; refresh(); } }, "Ver emendas no mapa")),
    h("div", { class: "warn" }, "Fonte: Portal da Transparência (CGU). Considera emendas individuais e Pix; o município é o do favorecido do recurso."));
  return box;
}

const medCache = {};
const median = (id) => (medCache[id] ??= percentile(getVar(id).arr, 0.5));
function munDetail(host, i) {
  host.append(h("h3", {}, "Vencedores nas demais eleições"));
  for (const d of S.index) {
    const x = S.ds[d.id]; const w = x.win[i]; if (w < 0) continue; const e = x.ents[w];
    host.append(h("div", { class: "win" }, h("i", { class: "sw", style: `background:${partyColor(e.p)}` }),
      h("span", {}, `${d.cargo.replace("Deputado ", "Dep. ")} ${d.turno}º ${d.year} — ${e.n}`), h("span", {}, fmt(x.winShare[i]) + "%")));
  }
  const emm = (S.em.byMun.get(i) || []).slice().sort((x, y) => y[1] - x[1]);
  if (emm.length) {
    host.append(h("h3", {}, `Emendas parlamentares recebidas · ${fmtMoney(emm.reduce((s, x) => s + x[1], 0))}`));
    emm.slice(0, 6).forEach(([ai, v]) => { const ck = candOfAuthor(ai); host.append(h("div", { class: "win", style: ck ? "cursor:pointer" : "", onclick: ck ? () => { const [ds, key] = ck.split("|"); pickEntity(ds, key); } : null },
      h("span", {}, `${S.em.authors[ai].n}${S.em.authors[ai].uf ? " · " + S.em.authors[ai].uf : ""}`), h("span", {}, fmtMoney(v)))); });
  }
  const prof = (title, ids) => {
    host.append(h("h3", {}, title));
    for (const id of ids) {
      const v = getVar(id); if (!v) continue; const val = v.arr[i]; if (!isFinite(val)) continue;
      host.append(h("div", { class: "kv" }, h("span", {}, v.label), h("b", {}, fmtVal(val, v.unit), h("span", { class: "muted" }, ` · mediana ${fmtVal(median(id), v.unit)}`))));
    }
  };
  prof("Indicadores IBGE (vs. mediana dos municípios)", ["i|pop", "i|renda_pc", "i|pibpc", "i|ni_sup", "i|urb", "i|rel_95277", "i|rel_95263", "i|r_negros", "i|esgoto_rede"]);
  prof("Perfil do eleitorado (TSE)", ["d|esc_sup", "d|esc_baixa", "d|i1624", "d|i60", "d|fem"]);
  host.append(h("div", { class: "row", style: "margin-top:12px" },
    h("button", { class: "btn pri", onclick: () => setTab("city") }, "Locais de votação e bairros →"),
    h("button", { class: "btn", onclick: () => setTab("corr") }, "Correlações")));
}

function renderRanking() {
  const host = $("#rank-box"); if (!host) return; host.innerHTML = "";
  const m = curMetric; if (!m || !m.arr) return;
  const el = eleitorado();
  const idx = m.idx.filter((i) => el[i] >= state.rk);
  if (idx.length < 4) return;
  idx.sort((a, b) => m.arr[b] - m.arr[a]);
  const mk = (list) => h("table", { class: "rank" }, list.map((i) => h("tr", { onclick: () => select(i, true) },
    h("td", {}, `${S.nome[i]} `, h("span", { class: "muted" }, S.uf[i])), h("td", {}, fmtVal(m.arr[i], m.unit)))));
  host.append(h("h3", {}, "Ranking de municípios"),
    h("div", { class: "row" }, h("span", { class: "muted", style: "font-size:12px;flex:none" }, "Com ≥"),
      h("select", { onchange: (e) => { state.rk = +e.target.value; saveHash(); renderRanking(); } },
        [0, 2000, 10000, 50000, 200000].map((v) => h("option", { value: v, selected: v === state.rk }, v ? fmtInt(v) + " eleitores" : "qualquer porte")))),
    h("div", { class: "muted", style: "font-size:12px;margin-top:6px" }, "Maiores"), mk(idx.slice(0, 8)),
    h("div", { class: "muted", style: "font-size:12px;margin-top:8px" }, "Menores"), mk(idx.slice(-8).reverse()));
}

// ---------------------------------------------------------------- ações
function refresh({ results = true } = {}) {
  if ($("#yr")) $("#yr").value = yearOf(state.ds);
  curMetric = computeMetric();
  setStates(); renderMapCard(); renderChips();
  if (results && state.tab === "map") renderResults(); else if (state.tab === "map") renderRanking();
  syncPickers(); saveHash();
}
function setDs(ds) {
  state.ds = ds; shown = 40; cq = "";
  const eo = entOfVar(state.v);
  if (state.mode !== "resid" && (!eo || eo.ds !== ds)) { if (state.mode === "var" || state.mode === "diff" || state.mode === "emenda") state.mode = "winner"; }
  refresh();
}
function setYear(y) {
  const first = CARGOS_YEAR[y].find((c) => S.ds[dsId(c, 1, y)]);
  state.dp = ""; state.mode = "winner"; if (y === 2024 && state.sel < 0) { /* eleição municipal: mostra partidos */ }
  setDs(dsId(first, 1, y));
}
function setUf(u) {
  state.uf = u; $("#uf").value = u; shown = 40; flyScope(); refresh();
  if (state.tab === "corr") renderCorr();
}
async function pickEntity(ds, key, toggle) {
  const id = `s|${ds}|${key}`;
  await ensureVars([id]);
  if (toggle && state.mode === "var" && state.v === id) state.mode = "winner";
  else { state.mode = "var"; state.v = id; if (state.ds !== ds) { state.ds = ds; } }
  const e = entInfo(ds, key);
  if (e && e.u && state.uf !== e.u) { state.uf = e.u; $("#uf").value = e.u; flyScope(); }
  if (state.tab !== "map") setTab("map"); else refresh();
}
async function focusCandidate(c) {
  const ds = c[0], key = "c" + c[2];
  state.ds = ds; state.dp = ""; cq = ""; shown = 40;
  if (c[1] && state.uf !== c[1]) { state.uf = c[1]; $("#uf").value = c[1]; flyScope(); }
  state.sel = c[8] != null ? c[8] : -1; setSelState();
  if (c[8] != null && bbox[c[8]]) fit(bbox[c[8]], { maxZoom: 10 });
  await ensureVars([`s|${ds}|${key}`]);
  if (S.ds[ds].isDep) { await loadChunk(ds, c[1]); state.dp = "c"; }
  state.mode = "var"; state.v = `s|${ds}|${key}`;
  if (state.tab !== "map") setTab("map"); else refresh();
}
function select(i, fly) {
  state.sel = i; setSelState();
  if (fly && i >= 0 && bbox[i]) fit(bbox[i], { maxZoom: 10 });
  if (state.tab === "map") renderResults(); else if (state.tab === "city") renderCity();
  if (state.tab === "corr" && scatter && i >= 0) { scatter.sel = i; scatter.draw(); }
  saveHash();
}

// ---------------------------------------------------------------- aba Cidade (locais de votação / bairros)
let locModel = [], locToken = 0;
function locTip(k) {
  const g = locModel[k]; if (!g) return "";
  const r = S.ds["pres" + state.locT]; const n = r.ents.length; const tot = g.v.slice(0, n).reduce((a, b) => a + b, 0);
  const top = r.ents.map((e, j) => ({ e, v: g.v[j] })).sort((a, b) => b.v - a.v).slice(0, 3);
  return `<b>${esc(g.nome)}</b><div class="muted">${esc(g.sub)}</div><div class="muted">${fmtInt(g.elei)} eleitores · ${g.secoes} seções</div>` +
    top.map((t) => `<div><span class="sw" style="display:inline-block;background:${partyColor(t.e.p)}"></span> ${esc(t.e.n)} <b style="font-family:var(--mono)">${fmt(tot ? t.v / tot * 100 : 0)}%</b></div>`).join("");
}
function clearLocais() { if (map && map.getSource("locais")) map.getSource("locais").setData({ type: "FeatureCollection", features: [] }); locModel = []; }
const bars = (items, total, max = 8) => {
  const wrap = h("div");
  for (const it of items.slice(0, max)) {
    const p = total > 0 ? it.v / total * 100 : 0;
    wrap.append(h("div", { class: "bar2" }, h("span", { class: "nm", title: it.n }, it.n), h("span", { class: "vl" }, `${fmt(p)}% · ${fmtInt(it.v)}`),
      h("div", { class: "tr" }, h("i", { style: `width:${Math.min(100, p)}%;background:${it.c}` }))));
  }
  return wrap;
};

async function renderCity() {
  const host = $("#tab-city"); const i = state.sel; const tok = ++locToken;
  host.innerHTML = "";
  if (i < 0) {
    clearLocais();
    host.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Locais de votação")), h("h2", {}, "Escolha um município"),
      h("p", { class: "lead" }, "Clique em um município no mapa ou use a busca para ver os locais de votação, os bairros e o voto em Presidente por seção."));
    return;
  }
  host.append(h("h2", {}, S.nome[i]), h("div", { class: "muted mono", style: "font-size:12px" }, `${UF_NOME[S.uf[i]]} · carregando locais…`));
  const data = await loadLocais(S.uf[i]); if (tok !== locToken) return;
  const rows = data.rows.filter((r) => r[0] === S.ibge[i]);
  const T = state.locT, r = S.ds["pres" + T], n = r.ents.length, vi = 9 + T;
  host.innerHTML = "";
  host.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Locais de votação"), h("span", { class: "scope" }, `${S.nome[i]} · ${S.uf[i]}`)),
    h("div", { class: "muted mono", style: "font-size:12px" }, `${fmtInt(rows.length)} locais · ${fmtInt(rows.reduce((a, x) => a + x[7], 0))} seções`));
  if (!rows.length) { host.append(h("p", { class: "muted" }, "Sem dados de locais para este município.")); clearLocais(); return; }

  const groups = new Map();
  const add = (key, row, extra) => {
    let g = groups.get(key); const v = row[vi];
    if (!g) { g = { key, nome: extra.nome, sub: extra.sub, v: new Array(n + 2).fill(0), elei: 0, secoes: 0, xs: 0, ys: 0, w: 0, pts: [] }; groups.set(key, g); }
    g.elei += row[6]; g.secoes += row[7];
    if (v) for (let k = 0; k < v.length; k++) g.v[k] += v[k];
    if (row[8] != null) { g.xs += row[8] * row[6]; g.ys += row[9] * row[6]; g.w += row[6]; g.pts.push([row[8], row[9]]); }
  };
  const byBairro = new Map();
  for (const row of rows) {
    const b = row[4] || "(sem bairro)";
    add(state.locMode === "local" ? `${row[1]}-${row[2]}` : b, row, state.locMode === "local" ? { nome: row[3], sub: `${b} · zona ${row[1]} · ${row[5]}` } : { nome: b, sub: "Bairro (agrupado)" });
    if (!byBairro.has(b)) byBairro.set(b, { nome: b, v: new Array(n + 2).fill(0), elei: 0, secoes: 0, locais: 0, pts: [] });
    const bb = byBairro.get(b); bb.elei += row[6]; bb.secoes += row[7]; bb.locais++;
    if (row[vi]) for (let k = 0; k < bb.v.length; k++) bb.v[k] += row[vi][k];
    if (row[8] != null) bb.pts.push([row[8], row[9]]);
  }
  locModel = [...groups.values()].filter((g) => g.v.slice(0, n).some((x) => x > 0));
  const city = new Array(n + 2).fill(0); locModel.forEach((g) => g.v.forEach((x, k) => (city[k] += x)));
  const candTot = city.slice(0, n).reduce((a, b) => a + b, 0);

  const segT = h("div", { class: "seg" }, [1, 2].map((t) => h("button", { class: T === t ? "on" : "", onclick: () => { state.locT = t; renderCity(); saveHash(); } }, `${t}º turno`)));
  const segG = h("div", { class: "seg" }, [["local", "Locais"], ["bairro", "Bairros"]].map(([k, l]) => h("button", { class: state.locMode === k ? "on" : "", onclick: () => { state.locMode = k; renderCity(); saveHash(); } }, l)));
  const colSel = h("select", { onchange: (e) => { state.locColor = e.target.value; renderCity(); saveHash(); } },
    h("option", { value: "win" }, "Vencedor (cor do partido)"), r.ents.slice(0, 6).map((e, j) => h("option", { value: "e" + j, selected: state.locColor === "e" + j }, `% de ${e.n}`)));
  host.append(h("label", { class: "f" }, "Turno (Presidente)"), segT, h("label", { class: "f" }, "Agrupar por"), segG, h("label", { class: "f" }, "Colorir por"), colSel);
  host.append(h("h3", {}, "Resultado no município (soma das seções)"),
    bars(r.ents.map((e, j) => ({ n: `${e.n} (${e.p})`, v: city[j], c: partyColor(e.p) })).sort((a, b) => b.v - a.v), candTot, 5));

  const nz = neutral();
  let lo = 0, hi = 1, cj = -1;
  if (state.locColor !== "win" && +state.locColor.slice(1) >= r.ents.length) state.locColor = "win";
  if (state.locColor !== "win") {
    cj = +state.locColor.slice(1);
    const sh = locModel.map((g) => { const t = g.v.slice(0, n).reduce((a, b) => a + b, 0); return t ? g.v[cj] / t * 100 : NaN; }).filter(isFinite);
    lo = percentile(sh, 0.02); hi = percentile(sh, 0.98); if (!(hi > lo)) hi = lo + 1;
  }
  const ramp = cj >= 0 ? candRamp(partyColor(r.ents[cj].p)) : null;
  const feats = [];
  locModel.forEach((g, k) => {
    const lon = g.w ? g.xs / g.w : null, lat = g.w ? g.ys / g.w : null; if (lon == null) return;
    const tot = g.v.slice(0, n).reduce((a, b) => a + b, 0); if (!tot) return;
    let color;
    if (cj >= 0) color = ramp((g.v[cj] / tot * 100 - lo) / (hi - lo));
    else {
      let a = -1, av = -1, bv = -1;
      for (let j = 0; j < n; j++) { const v = g.v[j]; if (v > av) { bv = av; av = v; a = j; } else if (v > bv) bv = v; }
      color = mix(nz, partyColor(r.ents[a].p), 0.35 + 0.65 * clamp((av - bv) / tot / 0.4));
    }
    feats.push({ type: "Feature", properties: { k, color, r: 2.2 + Math.sqrt(g.elei) / 13 }, geometry: { type: "Point", coordinates: [lon, lat] } });
  });
  map.getSource("locais").setData({ type: "FeatureCollection", features: feats });
  map.setPaintProperty("mun-fill", "fill-opacity", ["case", ["boolean", ["feature-state", "dim"], false], 0.06, 0.28]);
  if (!state.base) { autoBase = true; setBase(true); }
  const b = bbox[i]; if (b && !host.dataset.fitted) fit(b, { maxZoom: 12 });

  const list = [...byBairro.values()].sort((a, b2) => b2.elei - a.elei);
  const q = h("input", { type: "text", placeholder: "Filtrar bairro…", style: "margin:8px 0" });
  const tbody = h("tbody");
  const fill = () => {
    tbody.innerHTML = ""; const f = q.value.trim().toLowerCase();
    for (const bb of list) {
      if (f && !bb.nome.toLowerCase().includes(f)) continue;
      const tot = bb.v.slice(0, n).reduce((a, b2) => a + b2, 0);
      let a = -1, av = -1; for (let j = 0; j < n; j++) if (bb.v[j] > av) { av = bb.v[j]; a = j; }
      tbody.append(h("tr", { class: "c", onclick: () => { if (bb.pts.length) { const xs = bb.pts.map((p) => p[0]), ys = bb.pts.map((p) => p[1]); fit([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { maxZoom: 15 }); } } },
        h("td", {}, bb.nome), h("td", { class: "r" }, fmtInt(bb.elei)),
        h("td", {}, tot ? [h("i", { class: "sw", style: `display:inline-block;background:${partyColor(r.ents[a].p)};margin-right:5px` }), `${r.ents[a].n.split(" ")[0]} ${fmt(av / tot * 100, 0)}%`] : "—")));
    }
  };
  q.oninput = fill; fill();
  host.append(h("h3", {}, `Bairros (${list.length})`), q, h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Bairro"), h("th", {}, "Eleitores"), h("th", {}, "Líder"))), tbody)),
    h("div", { class: "warn" }, "Os bairros vêm do cadastro dos locais de votação do TSE; cada círculo é posicionado pela coordenada do local e dimensionado pelo nº de eleitores."));
  host.dataset.fitted = "1";
}

// ---------------------------------------------------------------- aba Correlação
let scatter = null, corrToken = 0;
function corrData() {
  const el = eleitorado();
  const rows = scopeIdx(state.uf).filter((i) => el[i] >= state.minE);
  const X = getVar(state.x), Y = getVar(state.y); if (!X || !Y) return null;
  return { rows, X, Y, x: take(X.arr, rows), y: take(Y.arr, rows), w: state.wt ? take(el, rows) : null, el };
}
async function renderCorr() {
  const tok = ++corrToken;
  await ensureVars([state.x, state.y, ...state.mx]); if (tok !== corrToken) return;
  const root = $("#view-corr .cv"); root.innerHTML = ""; scatter = null;
  const host = h("div", { class: "card cv-left" }), mid = h("div", { class: "card cv-mid" }), right = h("div", { class: "card cv-right" }), bottom = h("div", { class: "card cv-bottom" });
  root.append(host, mid, right, bottom);
  const px = picker(() => state.x, (v) => { state.x = v; renderCorr(); saveHash(); }, { noReg: true });
  const py = picker(() => state.y, (v) => { state.y = v; renderCorr(); saveHash(); }, { noReg: true });
  host.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Correlação"), h("span", { class: "scope" }, state.uf ? UF_NOME[state.uf] : "Nacional")),
    h("p", { class: "lead" }, "Cruze qualquer candidato ou partido com o perfil do eleitorado, indicadores do IBGE (renda, escolaridade, religião, PIB, saneamento…) ou outro resultado — município a município."),
    h("label", { class: "f" }, "Eixo X"), px,
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { [state.x, state.y] = [state.y, state.x]; renderCorr(); saveHash(); } }, "⇅ Trocar X e Y")),
    h("label", { class: "f" }, "Eixo Y"), py);
  const minSel = h("select", { onchange: (e) => { state.minE = +e.target.value; renderCorr(); saveHash(); } },
    [0, 2000, 5000, 10000, 30000, 100000].map((v) => h("option", { value: v, selected: v === state.minE }, v ? "≥ " + fmtInt(v) + " eleitores" : "todos os portes")));
  host.append(h("label", { class: "f" }, "Porte do município"), minSel,
    h("div", { class: "row", style: "margin-top:10px;flex-wrap:wrap" }, h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!state.wt, onchange: (e) => { state.wt = e.target.checked ? 1 : 0; renderCorr(); saveHash(); } }), "Ponderar pelo nº de eleitores"),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!state.bub, onchange: (e) => { state.bub = e.target.checked ? 1 : 0; renderCorr(); saveHash(); } }), "Tamanho = eleitorado")),
    h("div", { class: "warn" }, "O território é o do seletor “Estado” no topo."));

  const d = corrData(); if (!d) return;
  const P = pearson(d.x, d.y, d.w), rho = spearman(d.x, d.y);
  const out = mid;
  out.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Resultado"), h("span", { class: "scope" }, `${d.rows.length.toLocaleString("pt-BR")} municípios`)));
  if (!P) { out.append(h("div", { class: "note" }, "Dados insuficientes para esta combinação neste território (ex.: candidato a governador/senador/deputado só existe no próprio estado — selecione-o no topo).")); }
  else {
    const p = pValue(P.r, P.n);
    out.append(h("div", { class: "stats" },
      h("div", { class: "stat" }, h("b", {}, fmt(P.r, 3)), h("span", {}, state.wt ? "r de Pearson (pond.)" : "r de Pearson")),
      h("div", { class: "stat" }, h("b", {}, rho == null ? "—" : fmt(rho, 3)), h("span", {}, "ρ de Spearman")),
      h("div", { class: "stat" }, h("b", {}, (P.r2 * 100).toFixed(1) + "%"), h("span", {}, "R² (variância explicada)")),
      h("div", { class: "stat" }, h("b", {}, fmtInt(P.n)), h("span", {}, "municípios")),
      h("div", { class: "stat" }, h("b", {}, (P.slope >= 0 ? "+" : "") + fmt(P.slope, 2)), h("span", {}, "inclinação (Y por +1 em X)")),
      h("div", { class: "stat" }, h("b", {}, p < 0.001 ? "<0,001" : fmt(p, 3)), h("span", {}, "p-valor"))));
    out.append(h("div", { class: "note" }, h("b", {}, describe(P.r)[0].toUpperCase() + describe(P.r).slice(1) + ". "),
      `Em média, cada +1 unidade em “${d.X.label}” se associa a ${P.slope >= 0 ? "+" : "−"}${fmt(Math.abs(P.slope), 2)} em “${d.Y.label}”.`));
    out.append(h("div", { class: "warn" }, "Correlação entre municípios não implica causalidade nem descreve o comportamento individual de eleitores (falácia ecológica)."));
  }
  const wrap = h("div", { style: "margin-top:10px" }, h("canvas", { id: "sc" })); out.append(wrap);
  const cv = $("#sc", wrap);
  const legend = h("div", { class: "row", style: "flex-wrap:wrap;gap:10px;font-size:12px" }, Object.entries(REGIAO_COR).map(([k, c]) => h("span", {}, h("i", { class: "sw", style: `display:inline-block;background:${c};margin-right:4px` }), k)));
  const info = h("div", { class: "note", hidden: true }); out.append(legend, info);
  scatter = new Scatter(cv, {
    onHover: (id, e) => { if (id < 0) hideTip(); else showTip(`<b>${esc(S.nome[id])} · ${S.uf[id]}</b><div>X: ${fmtVal(d.X.arr[id], d.X.unit)}</div><div>Y: ${fmtVal(d.Y.arr[id], d.Y.unit)}</div>`, e); },
    onClick: (id) => {
      select(id, false);
      info.hidden = false;
      info.innerHTML = `<b>${esc(S.nome[id])} · ${S.uf[id]}</b> — X: ${fmtVal(d.X.arr[id], d.X.unit)} · Y: ${fmtVal(d.Y.arr[id], d.Y.unit)} `;
      info.append(h("button", { class: "chip", onclick: () => { setTab("map"); select(id, true); } }, "abrir no mapa"));
    },
    onBrush: (ids) => {
      setHighlight(ids || []); scatter.hl = ids && ids.length ? new Set(ids) : null; scatter.draw();
      if (!ids || !ids.length) { info.hidden = true; return; }
      const mean = (a) => ids.reduce((s, i) => s + a[i], 0) / ids.length;
      info.hidden = false;
      info.innerHTML = `<b>${fmtInt(ids.length)} municípios selecionados</b> (destacados no mapa). Média de X: <b>${fmtVal(mean(d.X.arr), d.X.unit)}</b> · média de Y: <b>${fmtVal(mean(d.Y.arr), d.Y.unit)}</b>.<br><span class="muted">${ids.slice(0, 8).map((i) => esc(S.nome[i])).join(", ")}${ids.length > 8 ? "…" : ""}</span> `;
      info.append(h("button", { class: "chip", onclick: () => { scatter.hl = null; setHighlight([]); info.hidden = true; scatter.draw(); } }, "limpar seleção"));
    } });
  scatter.maxH = 560; scatter.ratio = 0.62;
  scatter.set({ x: d.x, y: d.y, ids: d.rows, xl: d.X.label.length > 46 ? d.X.label.slice(0, 44) + "…" : d.X.label, yl: d.Y.label.length > 40 ? d.Y.label.slice(0, 38) + "…" : d.Y.label,
    xu: d.X.unit, yu: d.Y.unit, reg: P ? { slope: P.slope, intercept: P.intercept } : null,
    size: state.bub ? take(d.el, d.rows) : null, color: (id) => REGIAO_COR[REGIAO[S.uf[id]]] });
  if (state.sel >= 0) { scatter.sel = state.sel; scatter.draw(); }
  out.append(h("div", { class: "row", style: "margin-top:8px;flex-wrap:wrap" },
    h("button", { class: "btn", onclick: () => showVarOnMap(state.y) }, "Ver Y no mapa"),
    h("button", { class: "btn", onclick: () => showVarOnMap(state.x) }, "Ver X no mapa"),
    P ? h("button", { class: "btn pri", onclick: () => makeResidual(d, P) }, "Mapa de resíduos") : null),
    h("div", { class: "warn" }, "Arraste no gráfico para selecionar municípios e destacá-los no mapa. Clique em um ponto para abrir o município."));
  right.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Maiores correlações com Y")), topCorr(d));
  bottom.append(h("div", { class: "sec" }, h("span", { class: "k" }, "Matriz de correlação")), matrixSection(d));
  requestAnimationFrame(() => scatter && scatter.resize());
}
function showVarOnMap(id) { const eo = entOfVar(id); if (eo && eo.e) pickEntity(eo.ds, eo.key); else { state.mode = "var"; state.v = id; setTab("map"); } }
function makeResidual(d, P) {
  const arr = new Float64Array(S.N).fill(NaN), yy = new Float64Array(S.N).fill(NaN);
  d.rows.forEach((i, k) => { if (isFinite(d.x[k]) && isFinite(d.y[k])) { arr[i] = d.y[k] - (P.intercept + P.slope * d.x[k]); yy[i] = d.y[k]; } });
  residual = { arr, y: yy, label: `Resíduo: ${d.Y.label} (observado − esperado por ${d.X.label})` };
  state.mode = "resid"; setTab("map");
}
function allCandidateVars() { const out = []; for (const g of GROUPS) out.push(...g.items); return out; }
function topCorr(d) {
  const box = h("div"); const list = [];
  const nY = d.y.reduce((a, v) => a + (isFinite(v) ? 1 : 0), 0);
  for (const it of allCandidateVars()) {
    if (it.id === state.y) continue;
    const v = getVar(it.id); if (!v) continue;
    const x = take(v.arr, d.rows), P = pearson(x, d.y, d.w);
    if (P && P.n >= Math.max(25, 0.6 * nY)) list.push({ it, r: P.r, label: v.label });
  }
  list.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  for (const t of list.slice(0, 14)) {
    box.append(h("div", { class: "rl", title: t.label, onclick: () => { state.x = t.it.id; renderCorr(); saveHash(); } },
      h("span", { class: "nm" }, t.label),
      h("div", { class: "bg" }, h("i", { style: `left:${t.r >= 0 ? 50 : 50 + t.r * 50}%;width:${Math.abs(t.r) * 50}%;background:${t.r >= 0 ? DIV_POS : DIV_NEG}` }), h("i", { style: "left:50%;width:1px;background:var(--muted)" })),
      h("span", { class: "v" }, (t.r >= 0 ? "+" : "") + t.r.toFixed(2))));
  }
  if (!list.length) box.append(h("p", { class: "muted" }, "Sem dados."));
  box.append(h("div", { class: "warn" }, "Considera candidatos e partidos, participação, perfil do eleitorado (TSE) e indicadores do IBGE. Clique para usar como X."));
  return box;
}
let mxPending = "";
function entVar(ds, re) { const r = S.ds[ds]; const e = r?.ents.find((x) => re.test(x.n)); return e ? `s|${ds}|${e.k}` : null; }
function presetMx() {
  return [entVar("pres1", /fl[aá]vio/i), entVar("pres1", /lula/i), "d|esc_sup", "i|renda_pc", "i|rel_95277", "i|urb", "i|r_negros", "i|logpibpc", "t|pres1"].filter(Boolean);
}
function matrixSection(d) {
  const box = h("div");
  if (!state.mx.length) state.mx = presetMx();
  const F1 = entVar("pres1", /fl[aá]vio/i), L1 = entVar("pres1", /lula/i), L2 = entVar("pres2", /lula/i);
  const topParties = (ds, n) => S.ds[ds].ents.slice(0, n).map((e) => `s|${ds}|${e.k}`);
  const presets = [
    ["Presidente × perfil e IBGE", presetMx],
    ["Presidente × partidos (Dep. Fed.)", () => [F1, L1, ...topParties("dfed1", 7)].filter(Boolean)],
    ["Presidente × economia", () => [F1, L1, "i|pibpc", "i|va_agro", "i|va_ind", "i|va_adm", "i|emprego_formal", "i|salario_sm"].filter(Boolean)],
    ["1º × 2º turno", () => [F1, L1, entVar("pres2", /fl[aá]vio/i), L2, "t|pres1", "t|pres2", "d|esc_sup"].filter(Boolean)],
  ];
  box.append(h("div", { class: "chips" }, presets.map(([n, f]) => h("button", { class: "chip", onclick: () => { state.mx = f(); renderCorr(); saveHash(); } }, n))));
  box.append(h("div", { class: "chips" }, state.mx.map((id, k) => { const v = getVar(id); return h("button", { class: "chip rm", title: v?.label, onclick: () => { state.mx.splice(k, 1); renderCorr(); saveHash(); } }, `${k + 1}. ` + (v ? v.label.replace(/ — .*$/, "").slice(0, 26) : id)); })));
  box.append(h("div", { class: "row", style: "align-items:flex-start" }, h("div", { style: "flex:1" }, picker(() => mxPending || state.mx[0] || state.x, (v) => { mxPending = v; }, { noReg: true })),
    h("button", { class: "btn", onclick: () => { if (mxPending && !state.mx.includes(mxPending) && state.mx.length < 16) { state.mx.push(mxPending); renderCorr(); saveHash(); } } }, "+ adicionar")));
  const ids = state.mx.filter((id) => getVar(id));
  if (ids.length >= 2) {
    const vs = ids.map((id) => take(getVar(id).arr, d.rows)), n = ids.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(null));
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const P = i === j ? { r: 1 } : pearson(vs[i], vs[j], d.w); const r = P ? P.r : null; M[i][j] = r; M[j][i] = r; }
    const host = h("div", { style: "margin-top:8px" }); box.append(host);
    renderMatrix(host, ids.map((id) => getVar(id).label.replace(/ — /, " · ")), M, (i, j) => { state.x = ids[i]; state.y = ids[j]; renderCorr(); saveHash(); $("#view-corr").scrollTop = 0; }, neutral());
    box.append(h("div", { class: "warn" }, "Clique em uma célula para ver a dispersão daquele par."));
  }
  return box;
}

// ---------------------------------------------------------------- abas, busca, ferramentas
function setTab(t) {
  state.tab = t;
  document.body.classList.toggle("v-corr", t === "corr");
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === (t === "corr" ? "corr" : "map")));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll(".tab").forEach((s) => s.classList.toggle("on", s.id === "tab-" + t));
  if (t !== "city") { clearLocais(); if (autoBase) { autoBase = false; setBase(false); } if (map) map.setPaintProperty("mun-fill", "fill-opacity", fillOpacity()); $("#tab-city").dataset.fitted = ""; }
  if (t === "map") { curMetric = computeMetric(); setStates(); renderMapCard(); renderChips(); renderResults(); }
  if (t === "corr") { if (!state.x) state.x = "d|esc_sup"; if (!state.y) state.y = state.v || "i|renda_pc"; renderCorr(); }
  if (t === "city") { $("#tab-city").dataset.fitted = ""; renderCity(); }
  $(".body").scrollTop = 0;
  saveHash();
}
function setBase(on) { state.base = on; if (map) map.setLayoutProperty("base", "visibility", on ? "visible" : "none"); $("#btnBase").setAttribute("aria-pressed", on); if (map && state.tab !== "city") map.setPaintProperty("mun-fill", "fill-opacity", fillOpacity()); }

function initSearch() {
  const q = $("#q"), res = $("#qres");
  const names = S.nome.map(normS);
  let items = [], cur = 0;
  const close = () => { res.hidden = true; };
  q.oninput = () => {
    const v = normS(q.value.trim()); if (v.length < 2) return close();
    const cands = candMatches(q.value, 6);
    const starts = [], has = [];
    for (let i = 0; i < S.N; i++) { const n = names[i]; if (n.startsWith(v)) starts.push(i); else if (n.includes(v)) has.push(i); }
    const el = eleitorado(); const muns = [...starts.sort((a, b) => el[b] - el[a]), ...has.sort((a, b) => el[b] - el[a])].slice(0, 5);
    res.innerHTML = ""; items = [];
    if (cands.length) { res.append(h("h4", {}, "Candidatos")); cands.forEach((c) => { const b = candRow(c, () => { q.value = ""; close(); focusCandidate(c); }); items.push(b); res.append(b); }); }
    if (muns.length) { res.append(h("h4", {}, "Municípios")); muns.forEach((i) => { const b = h("button", { class: "qr", onclick: () => { q.value = ""; close(); select(i, true); if (state.tab !== "map") setTab("map"); } }, h("div", { class: "t" }, h("b", {}, S.nome[i]), h("small", {}, UF_NOME[S.uf[i]])), h("span", { class: "v" }, fmtInt(el[i]))); items.push(b); res.append(b); }); }
    res.hidden = !items.length; cur = 0; items[0]?.classList.add("on");
  };
  q.onkeydown = (e) => {
    if (e.key === "Enter") items[cur]?.click();
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[cur]?.classList.remove("on"); cur = (cur + (e.key === "ArrowDown" ? 1 : items.length - 1)) % Math.max(1, items.length); items[cur]?.classList.add("on"); items[cur]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Escape") close();
  };
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) close(); });
}

function initTools() {
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
  document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => setTab(b.dataset.view === "corr" ? "corr" : (state.tab === "city" ? "city" : "map"))));
  const yr = $("#yr"); yr.append(...ELEICOES.map(([y, l]) => h("option", { value: y }, l))); yr.value = yearOf(state.ds); yr.onchange = () => setYear(+yr.value);
  const uf = $("#uf"); uf.append(h("option", { value: "" }, "Brasil"), ...Object.entries(UF_NOME).map(([k, n]) => h("option", { value: k }, n)));
  uf.onchange = () => setUf(uf.value);
  $("#btnBase").onclick = () => { autoBase = false; setBase(!state.base); };
  $("#btnShare").onclick = async () => {
    saveHash(); await new Promise((r) => setTimeout(r, 300));
    try { await navigator.clipboard.writeText(location.href); $("#btnShare").textContent = "Copiado ✓"; } catch { $("#btnShare").textContent = "Veja a barra"; }
    setTimeout(() => ($("#btnShare").textContent = "Link"), 1800);
  };
  $("#btnTheme").onclick = () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch {}
    applyTheme();
  };
}
function applyTheme() {
  if (!map) return;
  map.setPaintProperty("bg", "background-color", css("--bg"));
  const lp = lineStyle(); map.setPaintProperty("mun-line", "line-color", lp["line-color"]);
  map.setPaintProperty("uf-line", "line-color", css("--text"));
  map.setPaintProperty("locais-c", "circle-stroke-color", css("--panel"));
  const bp = baseRasterPaint(); for (const k in bp) map.setPaintProperty("base", k, bp[k]);
  curMetric = computeMetric(); setStates(); renderMapCard();
  if (state.tab === "corr") renderCorr();
}

// ---------------------------------------------------------------- boot
(async function boot() {
  try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  const msg = $("#loadmsg");
  try {
    await loadAll((p) => (msg.textContent = `Carregando resultados… ${Math.round(p * 100)}%`));
    msg.textContent = "Montando o mapa…";
    GROUPS = varGroups();
    buildYears();
    loadHash();
    if (!S.ds[state.ds]) state.ds = "pres1";
    if (!state.v) state.v = entVar("pres1", /lula/i) || GROUPS[0].items[0].id;
    if (!state.y) state.y = entVar("pres1", /lula/i) || state.v;
    if (!state.x) state.x = "d|esc_sup";
    await ensureVars([state.v, state.vB, state.x, state.y, ...state.mx]);
    await initMap();
    initTools(); initSearch();
    $("#uf").value = state.uf;
    $("#loading").classList.add("done");
    document.querySelectorAll(".tab").forEach((s) => s.classList.remove("on"));
    const t = state.tab; state.tab = "";
    if (state.uf && ufBox[state.uf]) fit(ufBox[state.uf], { duration: 0 }); else fit([-74, -33.8, -34.8, 5.3], { duration: 0, maxZoom: 5 });
    if (state.sel >= 0) setSelState();
    setTab(t || "map");
    window.__hegemon = { S, state, map, select, setTab, getVar, focusCandidate };
  } catch (e) {
    console.error(e); msg.textContent = "Erro ao carregar: " + e.message;
  }
})();
