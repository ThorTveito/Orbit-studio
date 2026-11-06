// Procedural, hand-drawn-looking shapes. Every shape is generated in unit space (radius ≈ 1) from a
// seeded RNG, so it wobbles like a drawing but stays identical frame to frame. Different `v`
// (variant) values give slightly different redraws, which is what makes "boil" work.

import { TAU, rng, mk } from './util.js';

export function sparkle(n, mid, w, r) {
  // concave star with curved sides; `mid` = how far the side curves come in toward center
  const p = new Path2D(), tips = [];
  const step = TAU / n, base = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = base + i * step + (r() - .5) * w * 0.45 * step;
    const rad = 1 - r() * w * 0.35;
    tips.push([Math.cos(a) * rad, Math.sin(a) * rad, a]);
  }
  p.moveTo(tips[0][0], tips[0][1]);
  for (let i = 0; i < n; i++) {
    const t0 = tips[i], t1 = tips[(i + 1) % n];
    let a1 = t1[2]; if (a1 < t0[2]) a1 += TAU;
    const am = (t0[2] + a1) / 2 + (r() - .5) * w * 0.25 * step;
    const m = Math.min(mid * (1 + (r() - .5) * w * 0.7), Math.cos(Math.PI / n) * 0.92);
    const ir = 2 * m - Math.cos(Math.PI / n);
    p.quadraticCurveTo(Math.cos(am) * ir, Math.sin(am) * ir, t1[0], t1[1]);
  }
  p.closePath(); return p;
}
const mid2 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export function smoothClosed(pts) {
  const p = new Path2D(), n = pts.length;
  const m0 = mid2(pts[n - 1], pts[0]); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid2(pts[i], pts[(i + 1) % n]); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.closePath(); return p;
}
export function smoothOpen(pts) {
  const p = new Path2D(), n = pts.length; p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) { const m = mid2(pts[i], pts[i + 1]); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.lineTo(pts[n - 1][0], pts[n - 1][1]); return p;
}
export function poly(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
export const SPARKLES = ['star4', 'star5', 'star4', 'star6'];
export const OPEN = new Set(['spiral', 'squiggle', 'asterisk', 'scribble']); // line doodles: always stroked
const pathCache = new Map();
export function getPath(kind, g, i, v) {
  const key = `${kind}|${g.seed}|${i}|${v}|${g.thick}|${g.wobble}`;
  let p = pathCache.get(key); if (p) return p;
  if (pathCache.size > 4000) pathCache.clear();
  const r = rng((g.seed * 7919 + i * 104729 + v * 1299709 + kind.charCodeAt(kind.length - 1) * 31 + kind.length * 17) >>> 0);
  const w = g.wobble, j = s => (r() - .5) * w * s;
  switch (kind) {
    case 'star4': p = sparkle(4, g.thick, w, r); break;
    case 'star5': p = sparkle(5, g.thick * 1.15, w, r); break;
    case 'star6': p = sparkle(6, g.thick * 1.3, w, r); break;
    case 'star8': p = sparkle(8, g.thick * 1.6, w, r); break;
    case 'classic': { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * TAU / 10 + j(0.15); const rad = (k % 2 ? 0.38 + g.thick * 0.3 : 1) * (1 + j(0.2)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = poly(pts); break; }
    case 'heart': { p = new Path2D(); p.moveTo(j(.1), 0.85 + j(.1)); p.bezierCurveTo(-1.15 + j(.3), 0.05 + j(.3), -0.75 + j(.3), -1.0 + j(.3), j(.1), -0.42 + j(.15)); p.bezierCurveTo(0.75 + j(.3), -1.0 + j(.3), 1.15 + j(.3), 0.05 + j(.3), 0, 0.85); p.closePath(); break; }
    case 'dot': {
      if (w < 0.02) { p = new Path2D(); p.arc(0, 0, 0.62, 0, TAU); break; }
      const pts = []; for (let k = 0; k < 10; k++) { const a = k * TAU / 10; const rad = 0.62 * (1 + j(0.35)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = smoothClosed(pts); break;
    }
    case 'blob': { const pts = [], n = 8; for (let k = 0; k < n; k++) { const a = k * TAU / n + j(0.4); const rad = 0.85 * (1 + (r() - .5) * (0.2 + w * 0.6)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = smoothClosed(pts); break; }
    case 'moon': { p = new Path2D(); const s = j(.2); p.moveTo(0, -0.9); p.arc(0, 0, 0.9, -Math.PI / 2, Math.PI / 2, true); p.quadraticCurveTo(-0.5 + s, 0, 0, -0.9); p.closePath(); const m = new DOMMatrix().rotate(-25); const q = new Path2D(); q.addPath(p, m); p = q; break; }
    case 'bolt': p = poly([[0.2, -1], [-0.55, 0.12], [-0.06, 0.12], [-0.25, 1], [0.55, -0.18], [0.06, -0.18]].map(([x, y]) => [x + j(.15), y + j(.15)])); break;
    case 'flower': { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * TAU / 10; const rad = (k % 2 ? 0.28 : 1.25) * (1 + j(0.3)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = smoothClosed(pts); break; }
    case 'cross': { const a = 0.3, pts = [[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]]; p = poly(pts.map(([x, y]) => [x * 0.85 + j(.12), y * 0.85 + j(.12)])); break; }
    case 'spiral': { const pts = [], N = 56, turns = 2.6; for (let k = 0; k <= N; k++) { const f = k / N, a = f * turns * TAU + j(0.25); const rad = (0.06 + 0.94 * f) * (1 + j(0.2)); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = smoothOpen(pts); break; }
    case 'squiggle': { const pts = [], N = 22; for (let k = 0; k <= N; k++) { const f = k / N; pts.push([-1 + 2 * f + j(.08), 0.3 * Math.sin(f * TAU * 2) * (1 + j(.6)) + j(.08)]); } p = smoothOpen(pts); break; }
    case 'asterisk': { p = new Path2D(); const n = 8; for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k * TAU / n + j(0.3); const r1 = 1 + j(0.45), r0 = 0.1; const ma = a + j(0.25); p.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); p.quadraticCurveTo(Math.cos(ma) * r1 * 0.55, Math.sin(ma) * r1 * 0.55, Math.cos(a) * r1, Math.sin(a) * r1); } break; }
    case 'scribble': { const pts = [], N = 26; let a = r() * TAU; for (let k = 0; k < N; k++) { a += 0.9 + (r() - .3) * 1.1; const rad = 0.45 + 0.55 * r(); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]); } p = smoothOpen(pts); break; }
    default: p = sparkle(4, g.thick, w, r);
  }
  pathCache.set(key, p); return p;
}

/** Image for a custom (drawn/uploaded) object, tinted to `color` if the layer recolors it. */
export function customFor(g, color, v = 0) {
  const imgs = g.customVariants || (g.customImg ? [g.customImg] : null);
  if (!imgs) return null;
  const idx = v % imgs.length, img = imgs[idx];
  if (!g.tint) return img;
  const key = color + '|' + idx;
  let c = g._tints.get(key);
  if (!c) {
    c = mk(img.width, img.height); const x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    g._tints.set(key, c);
  }
  return c;
}
