// Turns layers into positioned, animated elements for a given time, and draws one element.
//
// Time model: motion runs in real time (layer speed = cycles per second). Only while exporting are
// speeds snapped to a whole number of cycles per loop (G.snapLen) so clips loop seamlessly.

import { TAU, rng, lerp } from './util.js';
import { G } from './state.js';
import { getPath, OPEN, SPARKLES, customFor } from './shapes.js';

// Motion runs in real time (speed = cycles per second). Only while exporting are speeds snapped to a
// whole number of cycles per clip (snapLen), so videos and GIFs loop without a seam.
const rate = v => G.snapLen ? Math.max(1, Math.round(v * G.snapLen)) / G.snapLen : v;
const SEC_RATE = 0.25; // base rate for twinkle / wiggle / float / self-spin
const boilVariant = (g, t) => g.boil ? Math.floor(t * g.boilFps) % 3 : 0;
function pushEl(out, g, i, v, x, y, d, R, ph, o = {}) {
  const { D } = G;
  const behind = o.behind ?? (g.depth === 'wrap' ? d < 0 : g.depth === 'behind');
  const dt = o.flat ? 1 : (d + 1) / 2;
  let size = g.size * D * (1 + (R.sz - .5) * g.sizeVar * 1.3) * lerp(g.backScale, 1, dt) * (o.sizeMul || 1);
  size *= 1 + g.twinkle * Math.sin(ph * 3 + R.ph);
  let rot = g.angle * Math.PI / 180 + (o.rot || 0) + (R.rot - .5) * g.rotVar * Math.PI;
  if (g.selfRot === 'wobble') rot += Math.sin(ph * 2 + R.ph) * g.selfRotAmt * Math.PI / 180;
  else if (g.selfRot === 'spin') rot += ph * (R.dir < .5 ? 1 : -1);
  y += Math.sin(ph * 2 + R.ph * 1.7) * g.bob * D * 0.03;
  const kind = g.shape === 'mixed' ? SPARKLES[Math.floor(R.kind * SPARKLES.length)] : g.shape;
  out.push({ g, i, v, x, y, d, behind, kind, rot, size: Math.max(1, size), alpha: lerp(1 - g.backFade, 1, dt), color: g.mixColors && R.col > 0.5 ? g.color2 : g.color });
}
const DRIFTS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], diag: [1, 1] };
function gridElements(g, t, out) {
  const { W, H, D } = G;
  const pm = TAU * t * rate(g.speed), ps = TAU * t * rate(SEC_RATE), v = boilVariant(g, t);
  const sp = Math.max(0.04, g.spacing) * D, rh = g.stagger ? sp * 0.866 : sp;
  const P = 4; // per-cell randomness repeats every P cells, so drifting patterns loop seamlessly
  let ox = (g.cx - 0.5) * W, oy = (g.cy - 0.5) * H;
  if (g.motion === 'spin') { const [dx, dy] = DRIFTS[g.drift] || DRIFTS.diag, f = t * rate(g.speed); ox += dx * f * P * sp; oy += dy * f * P * rh; }
  else if (g.motion === 'swing') ox += Math.sin(pm) * sp * (g.swingAmt / 90);
  const pX = P * sp, pY = P * rh;
  ox = ((ox % pX) + pX) % pX - pX; oy = ((oy % pY) + pY) % pY - pY;
  const cols = Math.ceil((W - ox) / sp) + 2, rows = Math.ceil((H - oy) / rh) + 2;
  if (cols * rows > 4000) return;
  for (let rI = -1; rI < rows; rI++) for (let cI = -1; cI < cols; cI++) {
    const rm = ((rI % P) + P) % P, cm = ((cI % P) + P) % P;
    const r = rng((g.seed + rm * 7919 + cm * 104729) >>> 0);
    const R = { jx: r(), jy: r(), sz: r(), ph: r() * TAU, kind: r(), col: r(), rot: r(), dep: r(), dir: r() };
    const x = ox + cI * sp + (g.stagger && rm % 2 ? sp / 2 : 0) + (R.jx - .5) * g.jitter * sp * 0.9;
    const y = oy + rI * rh + (R.jy - .5) * g.jitter * rh * 0.9;
    if (x < -sp || x > W + sp || y < -sp || y > H + sp) continue;
    const wrap = g.depth === 'wrap';
    pushEl(out, g, rm * P + cm, v, x, y, wrap ? (R.dep < 0.5 ? -1 : 1) : 0, R, ps, { flat: !wrap });
  }
}
export function groupElements(g, t, out) {
  const { W, H, D } = G;
  if (g.layout === 'grid') return gridElements(g, t, out);
  const r = rng(g.seed), pm = TAU * t * rate(g.speed), ps = TAU * t * rate(SEC_RATE), v = boilVariant(g, t);
  const spot = g.layout === 'spot', n = spot ? 1 : g.count, tl = g.tilt * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const R = { a: r(), rj: r(), sz: r(), ph: r() * TAU, kind: r(), col: r(), rot: r(), sx: r(), sy: r(), dep: r(), dir: r() };
    if (spot) {
      let rot = 0;
      if (g.motion === 'swing') rot = Math.sin(pm) * g.swingAmt * Math.PI / 180 * g.spinDir;
      else if (g.motion === 'spin') rot = pm * g.spinDir;
      pushEl(out, g, i, v, g.cx * W, g.cy * H, 0, { ...R, sz: 0.5, rot: 0.5 }, ps, { behind: g.depth !== 'front', flat: true, rot });
      continue;
    }
    let x, y, d;
    if (g.layout === 'ring' || g.layout === 'cloud') {
      const cloud = g.layout === 'cloud';
      let th = cloud ? R.a * TAU : -Math.PI / 2 + i * TAU / n + (R.a - .5) * g.jitter * (TAU / n);
      if (g.motion === 'swing') th += (g.swingAmt * Math.PI / 180) * Math.sin(pm);
      else if (g.motion === 'spin') th += pm * g.spinDir;
      const rj = cloud ? lerp(g.hole, 1, Math.sqrt(R.rj)) : 1 + (R.rj - .5) * g.jitter * 0.5;
      const lx = Math.cos(th) * g.rx * D * rj, ly = Math.sin(th) * g.ry * D * rj;
      x = g.cx * W + lx * Math.cos(tl) - ly * Math.sin(tl);
      y = g.cy * H + lx * Math.sin(tl) + ly * Math.cos(tl);
      d = cloud ? (R.dep < 0.45 ? 1 : -1) : Math.sin(th);
    } else {
      x = (0.04 + R.sx * 0.92) * W; y = (0.04 + R.sy * 0.92) * H;
      const amp = g.swingAmt / 90 * D * 0.06;
      if (g.motion === 'swing') x += Math.sin(pm + R.ph) * amp;
      else if (g.motion === 'spin') { const a = pm * g.spinDir + R.ph; x += Math.cos(a) * amp; y += Math.sin(a) * amp; }
      d = R.dep < 0.5 ? -1 : 1;
    }
    pushEl(out, g, i, v, x, y, d, R, ps);
  }
}
export function drawEl(c, e) {
  const g = e.g, s = e.size;
  c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.globalAlpha = e.alpha;
  if (g.glow > 0) { c.shadowColor = g.glowColor; c.shadowBlur = g.glow * s * 1.1 * G.RS; }
  if (e.kind === 'text') {
    const stroke = ['outline', 'sketch', 'both'].includes(g.style), fill = !['outline', 'sketch'].includes(g.style);
    c.font = `700 ${s * 1.8}px Inter, "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (g.style === 'both') { c.strokeStyle = g.strokeColor; c.lineWidth = g.strokeWidth * s * 2; c.strokeText(g.text, 0, 0); }
    else if (stroke) { c.strokeStyle = e.color; c.lineWidth = g.strokeWidth * s; c.strokeText(g.text, 0, 0); }
    if (fill) { c.fillStyle = e.color; c.fillText(g.text, 0, 0); }
  } else if (e.kind === 'custom' && g.customImg) {
    // Drawings have 3 real hand-redrawn variants that boil; a single uploaded image just jitters.
    const img = customFor(g, e.color, e.v), ar = img.width / img.height;
    let dw = 2 * s, dh = 2 * s; if (ar > 1) dh = dw / ar; else dw = dh * ar;
    if (g.boil && !g.customVariants) { const jr = rng(g.seed + e.i * 13 + e.v * 101); c.rotate((jr() - .5) * 0.12); c.scale(1 + (jr() - .5) * 0.06, 1 + (jr() - .5) * 0.06); }
    c.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    const kind = e.kind === 'custom' ? 'star4' : e.kind;
    c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    const p = getPath(kind, g, e.i, e.v), sw = g.strokeWidth;
    if (OPEN.has(kind)) {
      const lw = sw * (g.style === 'outline' ? 0.8 : 1.3);
      if (g.style === 'both') { c.strokeStyle = g.strokeColor; c.lineWidth = lw * 2.2; c.stroke(p); c.shadowBlur = 0; c.shadowColor = 'transparent'; }
      c.strokeStyle = e.color; c.lineWidth = lw; c.stroke(p);
      if (g.style === 'sketch' || g.style === 'painted') { c.lineWidth = lw * 0.6; c.globalAlpha = e.alpha * 0.8; c.stroke(getPath(kind, g, e.i, e.v + 5)); }
    }
    else if (g.style === 'fill') { c.fillStyle = e.color; c.fill(p); }
    else if (g.style === 'outline') { c.strokeStyle = e.color; c.lineWidth = sw; c.stroke(p); }
    else if (g.style === 'sketch') { c.strokeStyle = e.color; c.lineWidth = sw; c.stroke(p); c.lineWidth = sw * 0.55; c.globalAlpha = e.alpha * 0.8; c.stroke(getPath(kind, g, e.i, e.v + 5)); }
    else if (g.style === 'painted') {
      // layered fills of slightly different hand-drawn variants + a bristly dashed edge = brush-painted look
      c.fillStyle = e.color; c.fill(p);
      c.shadowBlur = 0; c.shadowColor = 'transparent';
      c.globalAlpha = e.alpha * 0.85;
      c.save(); c.rotate(0.035); c.scale(1.025, 0.99); c.fill(getPath(kind, g, e.i, e.v + 3)); c.restore();
      c.save(); c.rotate(-0.03); c.scale(0.99, 1.025); c.fill(getPath(kind, g, e.i, e.v + 6)); c.restore();
      c.globalAlpha = e.alpha; c.setLineDash([0.04, 0.03]); c.lineWidth = 0.035; c.strokeStyle = e.color; c.stroke(p); c.setLineDash([]);
    }
    else { c.strokeStyle = g.strokeColor; c.lineWidth = sw * 2; c.stroke(p); c.shadowBlur = 0; c.shadowColor = 'transparent'; c.fillStyle = e.color; c.fill(p); }
  }
  c.restore();
}

