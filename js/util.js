// Small DOM, math, color and file helpers shared by every module.

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const newSeed = () => (Math.random() * 1e9) | 0;

/** Create a canvas of the given size. */
export function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

/** Tiny element builder: h('div', 'cls', [children | text]). */
export function h(tag, cls, kids) {
  const e = document.createElement(tag); if (cls) e.className = cls;
  if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(k => e.append(k));
  return e;
}

/** Seeded PRNG (mulberry32) → deterministic "hand-drawn" randomness. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let toastT;
export function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function blobToImage(blob) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
}
export function urlToCanvas(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = mk(i.width, i.height); c.getContext('2d').drawImage(i, 0, 0); res(c); }; i.onerror = rej; i.src = url; });
}
export const canvasToBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));

// ── colors
export function hexRgb(hx) { const n = parseInt((hx || '#000000').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r, g, b) { return '#' + [r, g, b].map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function rgbHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0;
  if (d) { hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
  return [hh, mx ? d / mx : 0, mx];
}
export function hsvHex(hh, sat, val) {
  const f = n => { const k = (n + hh / 60) % 6; return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1)); };
  return rgbHex(f(5) * 255, f(3) * 255, f(1) * 255);
}
export function hsl(hh, s, l) {
  s /= 100; l /= 100; const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const luminance = hex => { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
