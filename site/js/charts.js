// Gráficos leves: dispersão em canvas (com seleção por retângulo) e matriz de correlação em HTML.
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export function hex(c) {
  if (c.startsWith("#")) { const n = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); }
  const m = c.match(/[\d.]+/g); if (c.startsWith("hsl")) return hsl2rgb(+m[0], +m[1] / 100, +m[2] / 100);
  return m.slice(0, 3).map(Number);
}
function hsl2rgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// divergente -1..1 : vermelho ← neutro → azul
export function divColor(t, neutral) {
  t = Math.max(-1, Math.min(1, t));
  return t >= 0 ? mix(neutral, "#2f6fd6", t) : mix(neutral, "#d6453d", -t);
}

export class Scatter {
  constructor(canvas, cb) {
    this.cv = canvas; this.cb = cb; this.pts = []; this.sel = -1; this.hl = null; this.hover = -1;
    this.pad = { l: 46, r: 12, t: 12, b: 38 };
    const ro = new ResizeObserver(() => this.resize()); ro.observe(canvas.parentElement);
    canvas.addEventListener("mousemove", (e) => this.onMove(e));
    canvas.addEventListener("mouseleave", () => { this.hover = -1; this.cb.onHover?.(-1); this.draw(); });
    canvas.addEventListener("mousedown", (e) => this.onDown(e));
    window.addEventListener("mouseup", (e) => this.onUp(e));
  }
  resize() {
    const p = this.cv.parentElement, dpr = window.devicePixelRatio || 1;
    this.W = p.clientWidth; this.H = Math.max(240, Math.min(this.maxH || 360, p.clientWidth * (this.ratio || 0.82)));
    this.cv.style.width = this.W + "px"; this.cv.style.height = this.H + "px";
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.ctx = this.cv.getContext("2d"); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout(); this.draw();
  }
  set(d) { this.d = d; this.layout(); this.draw(); }
  layout() {
    if (!this.d || !this.W) return;
    const { x, y, ids } = this.d;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < ids.length; k++) {
      const a = x[k], b = y[k]; if (!isFinite(a) || !isFinite(b)) continue;
      if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < y0) y0 = b; if (b > y1) y1 = b;
    }
    if (!isFinite(x0)) { this.pts = []; return; }
    const px = (x1 - x0) * 0.04 || 1, py = (y1 - y0) * 0.04 || 1;
    this.dom = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py };
    const { l, r, t, b } = this.pad, w = this.W - l - r, h = this.H - t - b;
    this.sx = (v) => l + (v - this.dom.x0) / (this.dom.x1 - this.dom.x0) * w;
    this.sy = (v) => t + h - (v - this.dom.y0) / (this.dom.y1 - this.dom.y0) * h;
    this.pts = [];
    for (let k = 0; k < ids.length; k++) {
      const a = x[k], b2 = y[k]; if (!isFinite(a) || !isFinite(b2)) continue;
      this.pts.push({ k, id: ids[k], px: this.sx(a), py: this.sy(b2) });
    }
  }
  draw() {
    const c = this.ctx; if (!c || !this.d) return;
    const { l, r, t, b } = this.pad, W = this.W, H = this.H;
    c.clearRect(0, 0, W, H);
    c.font = "11px 'DM Mono', monospace"; c.fillStyle = css("--muted"); c.strokeStyle = css("--line");
    if (!this.pts.length) { c.fillText("Sem dados suficientes para esta combinação", l + 8, H / 2); return; }
    const ticks = (a, z) => { const n = 5, o = []; for (let i = 0; i <= n; i++) o.push(a + (z - a) * i / n); return o; };
    c.lineWidth = 1;
    for (const v of ticks(this.dom.x0, this.dom.x1)) {
      const X = this.sx(v); c.beginPath(); c.moveTo(X, t); c.lineTo(X, H - b); c.stroke();
      c.textAlign = "center"; c.fillText(this.fmtAx(v, this.d.xu), X, H - b + 14);
    }
    for (const v of ticks(this.dom.y0, this.dom.y1)) {
      const Y = this.sy(v); c.beginPath(); c.moveTo(l, Y); c.lineTo(W - r, Y); c.stroke();
      c.textAlign = "right"; c.fillText(this.fmtAx(v, this.d.yu), l - 5, Y + 3);
    }
    c.textAlign = "center"; c.fillStyle = css("--text");
    c.fillText(this.d.xl, l + (W - l - r) / 2, H - 6);
    c.save(); c.translate(11, t + (H - t - b) / 2); c.rotate(-Math.PI / 2); c.fillText(this.d.yl, 0, 0); c.restore();
    const { size, color } = this.d;
    const hlSet = this.hl;
    for (const p of this.pts) {
      const rad = size ? 1.6 + Math.sqrt(size[p.k] / 1e5) * 3.2 : 2.4;
      c.globalAlpha = hlSet ? (hlSet.has(p.id) ? 0.95 : 0.12) : 0.62;
      c.fillStyle = color ? color(p.id) : css("--accent");
      c.beginPath(); c.arc(p.px, p.py, Math.min(rad, 14), 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
    if (this.d.reg) {
      const { slope, intercept } = this.d.reg;
      c.strokeStyle = css("--text"); c.lineWidth = 1.8; c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(this.sx(this.dom.x0), this.sy(intercept + slope * this.dom.x0));
      c.lineTo(this.sx(this.dom.x1), this.sy(intercept + slope * this.dom.x1)); c.stroke(); c.setLineDash([]);
    }
    for (const id of [this.sel, this.hover]) {
      const p = this.pts.find((q) => q.id === id); if (!p) continue;
      c.strokeStyle = css("--text"); c.lineWidth = 2; c.fillStyle = css("--accent");
      c.beginPath(); c.arc(p.px, p.py, 6, 0, 6.283); c.fill(); c.stroke();
    }
    if (this.brush) {
      const { x0, y0, x1, y1 } = this.brush;
      c.fillStyle = "rgba(100,140,255,.15)"; c.strokeStyle = "rgba(100,140,255,.9)"; c.lineWidth = 1;
      c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      c.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }
  fmtAx(v, u) { const a = Math.abs(v); const s = a >= 1e6 ? (v / 1e6).toFixed(1) + "M" : a >= 1e4 ? Math.round(v / 1e3) + "k" : a >= 100 ? Math.round(v) : a >= 10 ? v.toFixed(0) : v.toFixed(1); return u === "%" ? s + "%" : s; }
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  nearest(x, y, tol = 9) {
    let best = null, bd = tol * tol;
    for (const p of this.pts) { const d = (p.px - x) ** 2 + (p.py - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  onMove(e) {
    const { x, y } = this.pos(e);
    if (this.brush) { this.brush.x1 = x; this.brush.y1 = y; this.draw(); return; }
    const p = this.nearest(x, y);
    const id = p ? p.id : -1;
    if (id !== this.hover) { this.hover = id; this.cb.onHover?.(id, e); this.draw(); }
    else if (id >= 0) this.cb.onHover?.(id, e);
    this.cv.style.cursor = p ? "pointer" : "crosshair";
  }
  onDown(e) { const { x, y } = this.pos(e); this.brush = { x0: x, y0: y, x1: x, y1: y }; this.moved = false; this.down = { x, y }; }
  onUp(e) {
    if (!this.brush) return;
    const b = this.brush; this.brush = null;
    const dx = Math.abs(b.x1 - b.x0), dy = Math.abs(b.y1 - b.y0);
    if (dx < 5 && dy < 5) {
      const p = this.nearest(b.x0, b.y0, 10);
      if (p) { this.sel = p.id; this.cb.onClick?.(p.id); } else if (this.hl) { this.cb.onBrush?.(null); }
    } else {
      const xa = Math.min(b.x0, b.x1), xb = Math.max(b.x0, b.x1), ya = Math.min(b.y0, b.y1), yb = Math.max(b.y0, b.y1);
      const ids = this.pts.filter((p) => p.px >= xa && p.px <= xb && p.py >= ya && p.py <= yb).map((p) => p.id);
      this.cb.onBrush?.(ids);
    }
    this.draw();
  }
}

// matriz de correlação (HTML)
export function renderMatrix(host, labels, M, onCell, neutral) {
  host.innerHTML = "";
  const n = labels.length;
  const grid = document.createElement("div");
  grid.className = "mx";
  grid.style.gridTemplateColumns = `minmax(90px,1.4fr) repeat(${n}, minmax(26px,1fr))`;
  grid.appendChild(document.createElement("div"));
  labels.forEach((l, j) => { const d = document.createElement("div"); d.className = "mx-h"; d.textContent = String(j + 1); d.title = l; grid.appendChild(d); });
  for (let i = 0; i < n; i++) {
    const rl = document.createElement("div"); rl.className = "mx-r"; rl.textContent = `${i + 1}. ${labels[i]}`; rl.title = labels[i]; grid.appendChild(rl);
    for (let j = 0; j < n; j++) {
      const v = M[i][j], d = document.createElement("div"); d.className = "mx-c";
      if (v == null) { d.textContent = "–"; } else {
        d.style.background = divColor(v, neutral); d.textContent = Math.abs(v) >= 0.995 ? "1" : v.toFixed(2).replace("0.", ".").replace("-0.", "-.");
        d.style.color = Math.abs(v) > 0.55 ? "#fff" : "inherit"; d.title = `${labels[i]} × ${labels[j]}: r = ${v.toFixed(3)}`;
        if (i !== j) d.onclick = () => onCell(i, j);
      }
      grid.appendChild(d);
    }
  }
  host.appendChild(grid);
}
