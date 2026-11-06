// Compositing. Each frame is: background → objects behind → cut-out subject → objects in front.
// The background, cutout and styled subject are cached per photo and rebuilt only when dirty.
// With the Instagram frame on, the scene is drawn into a padded, clipped rectangle so nothing
// (not even animated objects) can spill onto the border.

import { TAU, mk, hexRgb } from './util.js';
import { S, G, dirty, caches, crop, aspectValue } from './state.js';
import { groupElements, drawEl } from './elements.js';
import { drawGuides, drawCropOverlay, brushPreview } from './tools.js';

const LOOKS = { original: 'none', pop: 'saturate(1.35) contrast(1.1)', bw: 'grayscale(1) contrast(1.1)', warm: 'sepia(.25) saturate(1.2)', cool: 'hue-rotate(-10deg) saturate(1.1) brightness(1.03)' };

function buildBg() {
  const { SW, SH, W, H, D } = G, c = caches.bg.getContext('2d'), b = S.bg, img = G.photo?.img, cr = crop();
  c.save(); c.clearRect(0, 0, SW, SH); c.filter = 'none';
  if (!img) {
    const gr = c.createLinearGradient(0, 0, SW, SH); gr.addColorStop(0, '#221a3a'); gr.addColorStop(1, '#3d2c63');
    c.fillStyle = gr; c.fillRect(0, 0, SW, SH); c.restore(); return;
  }
  switch (b.mode) {
    case 'original': c.drawImage(img, 0, 0); break;
    case 'blur': { const px = b.blur * D / 800, m = px * 2; c.filter = `blur(${px}px)`; c.drawImage(img, -m, -m, SW + 2 * m, SH + 2 * m); break; }
    case 'bw': c.filter = 'grayscale(1) contrast(1.05)'; c.drawImage(img, 0, 0); break;
    case 'dim': c.filter = `brightness(${1 - b.dim})`; c.drawImage(img, 0, 0); break;
    case 'solid': c.fillStyle = b.color; c.fillRect(0, 0, SW, SH); break;
    case 'gradient': { const gr = c.createLinearGradient(cr.x, cr.y, cr.x + W * .3, cr.y + H); gr.addColorStop(0, b.color); gr.addColorStop(1, b.color2); c.fillStyle = gr; c.fillRect(0, 0, SW, SH); break; }
    case 'none': break;
  }
  c.restore();
}
function buildCut() {
  const { SW, SH, D } = G, c = caches.cut.getContext('2d'), p = G.photo;
  c.save(); c.clearRect(0, 0, SW, SH);
  if (p) {
    c.filter = LOOKS[S.subject.look] || 'none'; c.drawImage(p.img, 0, 0); c.filter = 'none';
    c.globalCompositeOperation = 'destination-in';
    if (S.feather > 0) c.filter = `blur(${S.feather * D / 1000}px)`;
    c.drawImage(p.mask, 0, 0);
  }
  c.restore();
}
function buildSubj() {
  const { SW, SH, D } = G, c = caches.subj.getContext('2d'), sub = S.subject;
  c.save(); c.clearRect(0, 0, SW, SH);
  if (!G.photo?.hasCutout) { c.restore(); return; }
  let base = caches.cut;
  if (sub.outline > 0) {
    const o = outlineCanvas(caches.cut, sub.outline * D / 800, sub.outlineColor);
    o.getContext('2d').drawImage(caches.cut, 0, 0); base = o;
  }
  if (sub.glow > 0) { c.shadowColor = sub.glowColor; c.shadowBlur = sub.glow * D * 0.05; c.drawImage(base, 0, 0); c.drawImage(base, 0, 0); }
  if (sub.shadow > 0) { c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = sub.shadow * D * 0.04; c.shadowOffsetX = sub.shadow * D * 0.015; c.shadowOffsetY = sub.shadow * D * 0.02; }
  c.drawImage(base, 0, 0);
  c.restore();
}
/** Sticker outline: threshold to a clean silhouette (ignores faint mask noise), then grow it with
 *  blur + threshold for a smooth, round edge. */
function outlineCanvas(src, rad, color) {
  const { SW, SH } = G;
  const sil = mk(SW, SH), sx = sil.getContext('2d', { willReadFrequently: true });
  sx.drawImage(src, 0, 0);
  let id = sx.getImageData(0, 0, SW, SH), d = id.data;
  for (let i = 3; i < d.length; i += 4) { d[i - 3] = d[i - 2] = d[i - 1] = 255; d[i] = d[i] > 128 ? 255 : 0; }
  sx.putImageData(id, 0, 0);
  const o = mk(SW, SH), ox = o.getContext('2d', { willReadFrequently: true });
  ox.filter = `blur(${Math.max(0.6, rad / 2)}px)`; ox.drawImage(sil, 0, 0); ox.filter = 'none';
  id = ox.getImageData(0, 0, SW, SH); d = id.data;
  const [cr, cg, cb] = hexRgb(color), t0 = 3, t1 = 16;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3];
    d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = v <= t0 ? 0 : v >= t1 ? 255 : Math.round((v - t0) / (t1 - t0) * 255);
  }
  ox.putImageData(id, 0, 0);
  sx.globalCompositeOperation = 'source-in'; sx.fillStyle = color; sx.fillRect(0, 0, SW, SH);
  ox.drawImage(sil, 0, 0); // thin parts (fingers, hair) stay fully covered
  return o;
}
function ensureCaches(skipSubj) {
  if (dirty.cut) { buildCut(); dirty.cut = false; dirty.subj = true; }
  if (dirty.subj && !skipSubj) { buildSubj(); dirty.subj = false; }
  if (dirty.bg) { buildBg(); dirty.bg = false; }
}

export const isBrushTool = () => S.tool === 'erase' || S.tool === 'restore';

/** Draw the scene in crop-frame space (0..W, 0..H). opt.full draws the whole uncropped photo (crop tool). */
export function render(c, t, opt = {}) {
  const { SW, SH, W, H } = G, cr = crop();
  const brushMode = !opt.export && G.photo && isBrushTool();
  ensureCaches(brushMode);
  const full = !!opt.full, ox = full ? 0 : -cr.x, oy = full ? 0 : -cr.y;
  c.clearRect(0, 0, full ? SW : W, full ? SH : H);
  if (brushMode) {
    c.globalAlpha = 0.25; c.drawImage(G.photo.img, ox, oy); c.globalAlpha = 1;
    c.drawImage(caches.cut, ox, oy);
    brushPreview(c);
    return;
  }
  c.drawImage(caches.bg, ox, oy);
  const els = [];
  for (const g of S.groups) if (g.visible) groupElements(g, t, els);
  els.sort((a, b) => a.d - b.d);
  c.save(); if (full) c.translate(cr.x, cr.y);
  for (const e of els) if (e.behind) drawEl(c, e);
  c.restore();
  if (G.photo?.hasCutout) c.drawImage(caches.subj, ox, oy);
  c.save(); if (full) c.translate(cr.x, cr.y);
  for (const e of els) if (!e.behind) drawEl(c, e);
  c.restore();
  if (full && !opt.export) drawCropOverlay(c);
}

// ───────────────────────── Instagram frame

/** Frame size (in photo pixels) that pads the photo out to the chosen aspect, plus the photo offset.
 *  Border thickness `pad` is a fraction of the frame width and is the minimum on every side. */
export function frameLayout() {
  const f = S.frame; if (!f.on) return null;
  const A = aspectValue(f.aspect), { W, H, D } = G, p = f.pad;
  const FW = Math.ceil(Math.max(W / (1 - 2 * p), H / (1 / A - 2 * p)));
  const FH = Math.round(FW / A);
  return { FW, FH, ox: Math.round((FW - W) / 2), oy: Math.round((FH - H) / 2), r: f.radius * D * 0.15, A };
}

/** Render the final picture: the scene, wrapped in the frame when it's on. Guides are drawn on top,
 *  outside the clip, so ring handles stay visible on the border. */
export function renderOut(c, t, opt = {}) {
  const L = !opt.full && frameLayout();
  if (!L) {
    render(c, t, opt);
    if (opt.guides && !opt.full) drawGuides(c);
    return;
  }
  c.save();
  c.clearRect(0, 0, L.FW, L.FH);
  c.fillStyle = S.frame.color; c.fillRect(0, 0, L.FW, L.FH);
  c.translate(L.ox, L.oy);
  c.beginPath();
  if (L.r > 0 && c.roundRect) c.roundRect(0, 0, G.W, G.H, L.r); else c.rect(0, 0, G.W, G.H);
  c.clip();
  render(c, t, opt);
  c.restore();
  if (opt.guides) { c.save(); c.translate(L.ox, L.oy); drawGuides(c); c.restore(); }
}

/** Pixel size of an exported picture (frame → exact Instagram size, else the cropped photo). */
export function exportSize() {
  const L = frameLayout();
  if (!L) return { w: G.W, h: G.H, sx: 1, sy: 1 };
  const w = S.frame.size, h = Math.round(w / L.A);
  return { w, h, sx: w / L.FW, sy: h / L.FH };
}
/** Draw one export frame into `c` (sized by exportSize()). */
export function renderExport(c, t, dims = exportSize()) {
  G.RS = (dims.sx + dims.sy) / 2;
  c.setTransform(dims.sx, 0, 0, dims.sy, 0, 0);
  renderOut(c, t, { export: true });
  c.setTransform(1, 0, 0, 1, 0, 0);
  G.RS = 1;
}
