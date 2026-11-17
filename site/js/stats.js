// Estatística: correlação de Pearson (ponderada ou não), Spearman, regressão linear, matriz.
export function pearson(x, y, w) {
  let sw = 0, mx = 0, my = 0, n = 0;
  for (let i = 0; i < x.length; i++) {
    if (!isFinite(x[i]) || !isFinite(y[i])) continue;
    const wi = w ? w[i] : 1; if (!(wi > 0)) continue;
    sw += wi; mx += wi * x[i]; my += wi * y[i]; n++;
  }
  if (n < 3) return null;
  mx /= sw; my /= sw;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) {
    if (!isFinite(x[i]) || !isFinite(y[i])) continue;
    const wi = w ? w[i] : 1; if (!(wi > 0)) continue;
    const dx = x[i] - mx, dy = y[i] - my;
    sxx += wi * dx * dx; syy += wi * dy * dy; sxy += wi * dx * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const slope = sxy / sxx;
  return { r, n, slope, intercept: my - slope * mx, mx, my, r2: r * r };
}

export function ranks(v) {
  const idx = []; for (let i = 0; i < v.length; i++) if (isFinite(v[i])) idx.push(i);
  idx.sort((a, b) => v[a] - v[b]);
  const rk = new Float64Array(v.length).fill(NaN);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
    const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) rk[idx[k]] = r; i = j + 1;
  }
  return rk;
}

export function spearman(x, y) {
  const m = new Float64Array(x.length).fill(NaN), n2 = new Float64Array(x.length).fill(NaN);
  for (let i = 0; i < x.length; i++) if (isFinite(x[i]) && isFinite(y[i])) { m[i] = x[i]; n2[i] = y[i]; }
  const p = pearson(ranks(m), ranks(n2));
  return p ? p.r : null;
}

// p-valor bilateral aproximado (normal sobre estatística t; adequado para n grande)
export function pValue(r, n) {
  if (n < 4) return 1;
  const t = Math.abs(r) * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
  const z = t; // aproximação normal
  const p = 2 * (1 - normCdf(z));
  return Math.max(0, Math.min(1, p));
}
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const pr = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - pr;
}

export function describe(r) {
  const a = Math.abs(r);
  const f = a >= 0.8 ? "muito forte" : a >= 0.6 ? "forte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "fraca" : "desprezível";
  return a < 0.2 ? "correlação desprezível" : `correlação ${f} ${r > 0 ? "positiva" : "negativa"}`;
}

export function percentile(arr, p) {
  const v = Array.from(arr).filter(isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const k = (v.length - 1) * p, f = Math.floor(k), c = Math.ceil(k);
  return v[f] + (v[c] - v[f]) * (k - f);
}

// subconjunto por índices
export function take(arr, idx) { const o = new Float64Array(idx.length); for (let i = 0; i < idx.length; i++) o[i] = arr[idx[i]]; return o; }
