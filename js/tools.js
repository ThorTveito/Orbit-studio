// Editor tools: Move (layers), Hand, Zoom, Crop, Erase/Restore brushes, plus all pointer handling
// on the stage, the contextual options bar and the on-canvas guides.

import { $, $$, h, TAU, clamp, toast } from './util.js';
import { S, G, canvas, curG, crop, syncGeometry, dirty } from './state.js';
import { stage, view, zoomAt, zoomStep, zoom100, panBy, fitView, sizeCanvas, sceneOffset, canvasScale, refreshCanvas } from './viewport.js';
import { pushUndo, undo } from './cutout.js';
import { syncFields, buildGroupPanel } from './panels.js';

let pointer = null, drag = null, lastBrush = null, pan = null;
export const keys = { space: false, alt: false };
let cropDraft = null, cropAspect = 'free';

// ── geometry helpers
/** Pointer position in scene (crop-frame) pixels. `k` = scene pixels per screen pixel. */
function toScene(e) {
  const r = canvas.getBoundingClientRect(), k = canvas.width / r.width, o = sceneOffset();
  return { x: (e.clientX - r.left) * k - o.x, y: (e.clientY - r.top) * k - o.y, k };
}
export function ringHandles(g) {
  const { W, H, D } = G, tl = g.tilt * Math.PI / 180, cx = g.cx * W, cy = g.cy * H;
  return { c: [cx, cy], rx: [cx + Math.cos(tl) * g.rx * D, cy + Math.sin(tl) * g.rx * D], ry: [cx - Math.sin(tl) * g.ry * D, cy + Math.cos(tl) * g.ry * D], tl };
}
const hasEllipse = g => g.layout === 'ring' || g.layout === 'cloud';
const draggable = g => g && g.visible && g.layout !== 'scatter';
function hitRing(g, p) {
  const hd = ringHandles(g), R = 16 * p.k;
  if (Math.hypot(p.x - hd.rx[0], p.y - hd.rx[1]) < R) return 'rx';
  if (Math.hypot(p.x - hd.ry[0], p.y - hd.ry[1]) < R) return 'ry';
  return null;
}

// ── drawing on the canvas
export function drawGuides(c) {
  const g = curG(); if (!draggable(g) || S.tool !== 'move' || g.layout === 'grid') return;
  const { D } = G, k = canvasScale(), hd = ringHandles(g);
  c.save(); c.beginPath();
  if (hasEllipse(g)) c.ellipse(hd.c[0], hd.c[1], g.rx * D, g.ry * D, hd.tl, 0, TAU);
  else c.arc(hd.c[0], hd.c[1], g.size * D, 0, TAU);
  c.setLineDash([8 * k, 7 * k]); c.lineWidth = 3 * k; c.strokeStyle = '#0008'; c.stroke();
  c.lineWidth = 1.5 * k; c.strokeStyle = '#fff'; c.stroke(); c.setLineDash([]);
  const pts = hasEllipse(g) ? [['c', hd.c], ['rx', hd.rx], ['ry', hd.ry]] : [['c', hd.c]];
  for (const [name, q] of pts) {
    c.beginPath(); c.arc(q[0], q[1], (name === 'c' ? 9 : 7) * k, 0, TAU);
    c.fillStyle = name === 'c' ? '#ff5fa2' : '#fff'; c.fill(); c.lineWidth = 2 * k; c.strokeStyle = '#000a'; c.stroke();
  }
  c.restore();
}
export function brushPreview(c) {
  if (!pointer) return;
  const k = pointer.k;
  c.save(); c.beginPath(); c.arc(pointer.x, pointer.y, S.brush * k / 2, 0, TAU);
  c.lineWidth = 2 * k; c.strokeStyle = '#000a'; c.stroke();
  c.lineWidth = k; c.strokeStyle = S.tool === 'erase' ? '#ff6b6b' : '#5dffb0'; c.stroke(); c.restore();
}

// ── crop
const ASPECTS = [['free', 'Free'], ['original', 'Original'], ['1:1', '1:1 Square'], ['4:5', '4:5 Portrait'], ['3:4', '3:4 Portrait'], ['9:16', '9:16 Story / Reel'], ['16:9', '16:9 Wide'], ['3:2', '3:2'], ['2:3', '2:3']];
function aspectRatio() {
  if (cropAspect === 'free') return null;
  if (cropAspect === 'original') return G.SW / G.SH;
  const [a, b] = cropAspect.split(':').map(Number); return a / b;
}
function cropHandles(r) {
  const x1 = r.x + r.w, y1 = r.y + r.h, mx = r.x + r.w / 2, my = r.y + r.h / 2;
  const hs = { nw: [r.x, r.y], ne: [x1, r.y], sw: [r.x, y1], se: [x1, y1] };
  if (!aspectRatio()) Object.assign(hs, { n: [mx, r.y], s: [mx, y1], w: [r.x, my], e: [x1, my] });
  return Object.entries(hs);
}
export function drawCropOverlay(c) {
  const r = cropDraft; if (!r) return;
  const { SW, SH } = G, k = canvasScale();
  c.save();
  c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.rect(0, 0, SW, SH); c.rect(r.x, r.y, r.w, r.h); c.fill('evenodd');
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = k; c.beginPath();
  for (let i = 1; i < 3; i++) { c.moveTo(r.x + r.w * i / 3, r.y); c.lineTo(r.x + r.w * i / 3, r.y + r.h); c.moveTo(r.x, r.y + r.h * i / 3); c.lineTo(r.x + r.w, r.y + r.h * i / 3); }
  c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 1.5 * k; c.strokeRect(r.x, r.y, r.w, r.h);
  for (const [, [hx, hy]] of cropHandles(r)) { c.fillStyle = '#fff'; c.fillRect(hx - 6 * k, hy - 6 * k, 12 * k, 12 * k); c.lineWidth = 1.5 * k; c.strokeStyle = '#000b'; c.strokeRect(hx - 6 * k, hy - 6 * k, 12 * k, 12 * k); }
  const label = `${Math.round(r.w)} × ${Math.round(r.h)}`;
  c.font = `600 ${12 * k}px Inter, sans-serif`; const tw = c.measureText(label).width;
  const lx = r.x + 8 * k, ly = Math.max(r.y + 8 * k, 0);
  c.fillStyle = '#000b'; c.fillRect(lx, ly, tw + 12 * k, 20 * k); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, lx + 6 * k, ly + 10 * k);
  c.restore();
}
export function setAspect(a) {
  const { SW, SH } = G;
  cropAspect = a; const ratio = aspectRatio(); if (!ratio || !cropDraft) return;
  const cx = cropDraft.x + cropDraft.w / 2, cy = cropDraft.y + cropDraft.h / 2;
  let w = SW, hh = w / ratio; if (hh > SH) { hh = SH; w = hh * ratio; }
  cropDraft = { x: clamp(cx - w / 2, 0, SW - w), y: clamp(cy - hh / 2, 0, SH - hh), w, h: hh };
}
function hitCrop(p) {
  const r = cropDraft; if (!r) return null; const R = 14 * p.k;
  for (const [name, [hx, hy]] of cropHandles(r)) if (Math.abs(p.x - hx) < R && Math.abs(p.y - hy) < R) return name;
  if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) return 'cmove';
  return null;
}
function cropDragTo(p) {
  const { SW, SH } = G, d = drag, r0 = d.r0;
  if (d.type === 'cmove') { cropDraft = { ...r0, x: clamp(r0.x + p.x - d.sx, 0, SW - r0.w), y: clamp(r0.y + p.y - d.sy, 0, SH - r0.h) }; return; }
  const hnd = d.type, px = clamp(p.x, 0, SW), py = clamp(p.y, 0, SH), ratio = aspectRatio();
  let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.h;
  if (ratio && hnd.length === 2) {
    const ax = hnd.includes('w') ? x1 : x0, ay = hnd.includes('n') ? y1 : y0;
    let w = Math.abs(px - ax), hh = Math.abs(py - ay) || 1;
    if (w / hh > ratio) w = hh * ratio; else hh = w / ratio;
    const maxW = hnd.includes('w') ? ax : SW - ax, maxH = hnd.includes('n') ? ay : SH - ay;
    const s = Math.min(1, maxW / (w || 1), maxH / (hh || 1)); w *= s; hh *= s;
    x0 = hnd.includes('w') ? ax - w : ax; y0 = hnd.includes('n') ? ay - hh : ay; x1 = x0 + w; y1 = y0 + hh;
  } else {
    if (hnd.includes('w')) x0 = px; if (hnd.includes('e')) x1 = px;
    if (hnd.includes('n')) y0 = py; if (hnd.includes('s')) y1 = py;
  }
  cropDraft = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.max(16, Math.abs(x1 - x0)), h: Math.max(16, Math.abs(y1 - y0)) };
}
export function applyCrop() {
  const r = cropDraft, p = G.photo; if (!r || !p) return;
  const { SW, SH } = G;
  const w = Math.max(16, Math.round(r.w / 2) * 2), hh = Math.max(16, Math.round(r.h / 2) * 2);
  const nc = { x: clamp(Math.round(r.x), 0, SW - w), y: clamp(Math.round(r.y), 0, SH - hh), w, h: hh };
  const oW = G.W, oH = G.H, oD = G.D, ox = p.crop.x, oy = p.crop.y;
  Object.assign(p.crop, nc); syncGeometry();
  // With a single photo, keep every ring at the same spot/size on the photo. With several photos the
  // layers are shared, so they stay relative to each frame instead.
  if (G.photos.length === 1) for (const g of S.groups) {
    const ax = ox + g.cx * oW, ay = oy + g.cy * oH, s = oD / G.D;
    g.cx = (ax - p.crop.x) / G.W; g.cy = (ay - p.crop.y) / G.H; g.rx *= s; g.ry *= s; g.size *= s;
  }
  dirty.bg = true; cropDraft = null;
  setTool('move'); buildGroupPanel();
  toast(`Cropped to ${G.W} × ${G.H}`);
}
export function cancelCrop() { cropDraft = null; setTool('move'); }
export const cropActive = () => S.tool === 'crop';

// ── cutout brushes
function brushTo(p) {
  const ph = G.photo, cr = ph.crop, m = ph.mask.getContext('2d');
  m.save(); m.globalCompositeOperation = S.tool === 'erase' ? 'destination-out' : 'source-over';
  m.strokeStyle = '#fff'; m.lineCap = 'round'; m.lineJoin = 'round'; m.lineWidth = S.brush * p.k;
  const a = lastBrush || p;
  m.beginPath(); m.moveTo(a.x + cr.x, a.y + cr.y); m.lineTo(p.x + cr.x + 0.01, p.y + cr.y); m.stroke(); m.restore();
  lastBrush = p; ph.hasCutout = true; dirty.cut = true;
}

// ── cursor + pointer handling
const CROP_CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', cmove: 'move' };
export function updateCursor(p = pointer) {
  let cur = 'default';
  if (pan) cur = 'grabbing';
  else if (keys.space || S.tool === 'hand') cur = 'grab';
  else if (S.tool === 'zoom') cur = keys.alt ? 'zoom-out' : 'zoom-in';
  else if (S.tool === 'crop') cur = p ? (CROP_CURSORS[hitCrop(p)] || 'crosshair') : 'crosshair';
  else if (S.tool === 'move') { const g = curG(); cur = draggable(g) ? (p && hasEllipse(g) && hitRing(g, p) ? 'crosshair' : 'grab') : 'default'; }
  else cur = G.photo ? 'none' : 'default';
  stage.style.cursor = cur;
}
// In crop mode the canvas shows the uncropped photo (no frame), so scene coords = canvas coords.
stage.addEventListener('pointerdown', e => {
  if (e.target.closest?.('#dropCard, #busy')) return;
  const p = toScene(e); pointer = p;
  if (e.button === 1 || keys.space || S.tool === 'hand') {
    e.preventDefault(); pan = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); updateCursor(p); return;
  }
  if (e.button !== 0) return;
  if (S.tool === 'zoom') { const r = stage.getBoundingClientRect(); zoomAt(view.zoom * (e.altKey ? 1 / 1.6 : 1.6), e.clientX - r.left, e.clientY - r.top); return; }
  if (S.tool === 'crop') {
    if (!G.photo) return;
    let type = hitCrop(p);
    if (!type) { cropDraft = { x: clamp(p.x, 0, G.SW), y: clamp(p.y, 0, G.SH), w: 0, h: 0 }; type = 'se'; }
    drag = { type, r0: { ...cropDraft }, sx: p.x, sy: p.y }; stage.setPointerCapture(e.pointerId); return;
  }
  if (S.tool === 'move') {
    const g = curG(); if (!draggable(g)) return;
    drag = { type: (hasEllipse(g) && hitRing(g, p)) || 'move', g, sx: p.x, sy: p.y, cx0: g.cx, cy0: g.cy };
    stage.setPointerCapture(e.pointerId); stage.style.cursor = drag.type === 'move' ? 'grabbing' : 'crosshair';
  } else if (G.photo) {
    pushUndo(); lastBrush = null; brushTo(p); drag = { type: 'brush' };
    stage.setPointerCapture(e.pointerId);
  }
});
stage.addEventListener('pointermove', e => {
  if (pan) { panBy(e.clientX - pan.x, e.clientY - pan.y); pan = { x: e.clientX, y: e.clientY }; return; }
  const p = toScene(e); pointer = p;
  if (!drag) { updateCursor(p); return; }
  if (drag.type === 'brush') { brushTo(p); return; }
  if (S.tool === 'crop') { cropDragTo(p); return; }
  const g = drag.g, { W, H, D } = G;
  if (drag.type === 'move') { g.cx = drag.cx0 + (p.x - drag.sx) / W; g.cy = drag.cy0 + (p.y - drag.sy) / H; }
  else if (drag.type === 'rx') {
    const vx = p.x - g.cx * W, vy = p.y - g.cy * H;
    g.rx = Math.max(0.02, Math.hypot(vx, vy) / D);
    let tl = Math.atan2(vy, vx) * 180 / Math.PI; if (tl > 90) tl -= 180; if (tl < -90) tl += 180; g.tilt = Math.round(tl);
  } else if (drag.type === 'ry') {
    const tl = g.tilt * Math.PI / 180, vx = p.x - g.cx * W, vy = p.y - g.cy * H;
    g.ry = Math.max(0.02, Math.abs(-Math.sin(tl) * vx + Math.cos(tl) * vy) / D);
  }
  syncFields(['cx', 'cy', 'rx', 'ry', 'tilt']);
});
const endDrag = e => { pan = null; drag = null; lastBrush = null; updateCursor(e && e.clientX != null ? toScene(e) : null); };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('pointerleave', () => { if (!drag) pointer = null; });
stage.addEventListener('auxclick', e => e.preventDefault());
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const r = stage.getBoundingClientRect(), mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
  const dx = e.deltaX * mul, dy = e.deltaY * mul;
  if (e.ctrlKey || e.metaKey || e.altKey) {
    const k = Math.abs(dy) < 40 ? 0.012 : 0.0025; // trackpad pinch vs mouse wheel
    zoomAt(view.zoom * Math.exp(-dy * k), e.clientX - r.left, e.clientY - r.top);
  } else if (e.shiftKey && !dx) panBy(-dy, 0);
  else panBy(-dx, -dy);
}, { passive: false });

// ── tool switching + options bar
export function setTool(t) {
  if ((t === 'erase' || t === 'restore' || t === 'crop') && !G.photo) { toast('Open a photo first.'); return; }
  const was = S.tool;
  if (t === 'crop' && was !== 'crop') { cropDraft = { ...crop() }; cropAspect = 'free'; }
  if (was === 'crop' && t !== 'crop') cropDraft = null;
  S.tool = t;
  $$('#tools .tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  if (sizeCanvas() || (t === 'crop') !== (was === 'crop')) refreshCanvas();
  buildOptbar(); updateCursor();
}
const OPT_TITLES = { move: 'Move layer', hand: 'Hand', zoom: 'Zoom', crop: 'Crop', erase: 'Erase brush', restore: 'Restore brush' };
export function buildOptbar() {
  const el = $('#optbar'); el.innerHTML = '';
  const t = S.tool, btn = (label, fn, cls = '') => { const b = h('button', 'tb ' + cls, label); b.onclick = fn; return b; };
  el.append(h('span', 'ttl', OPT_TITLES[t]));
  if (t === 'move') { el.append(h('span', 'muted', '')); updateHint(); }
  if (t === 'hand') el.append(h('span', 'muted', 'Drag to pan. Scroll pans too, and Ctrl/⌘ + scroll or a pinch zooms. Hold Space to pan with any tool.'), h('span', 'spacer'), btn('Fit on screen', fitView), btn('100%', zoom100));
  if (t === 'zoom') el.append(btn('＋ Zoom in', () => zoomStep(1)), btn('− Zoom out', () => zoomStep(-1)), btn('Fit on screen', fitView), btn('100%', zoom100), h('span', 'muted', 'Click to zoom in, Alt-click to zoom out'));
  if (t === 'crop') {
    const sel = h('select'); ASPECTS.forEach(([v, l]) => { const o = h('option', null, l); o.value = v; sel.append(o); }); sel.value = cropAspect;
    sel.onchange = () => setAspect(sel.value);
    el.append(sel, h('span', 'muted', 'Drag corners · Enter applies, Esc cancels'), h('span', 'spacer'),
      btn('Reset', () => { cropAspect = 'free'; sel.value = 'free'; cropDraft = { x: 0, y: 0, w: G.SW, h: G.SH }; }), btn('Cancel', cancelCrop), btn('✓ Apply crop', applyCrop, 'primary'));
  }
  if (t === 'erase' || t === 'restore') {
    const inp = h('input'); inp.type = 'range'; inp.min = 4; inp.max = 300; inp.value = S.brush; inp.id = 'brushSize'; inp.style.width = '130px';
    const out = h('output', null, S.brush + ' px'); out.id = 'brushOut';
    inp.oninput = () => { S.brush = +inp.value; out.textContent = S.brush + ' px'; };
    el.append(h('label', 'brushctl', ['Size', inp, out]), h('span', 'muted', '[ and ] change size. Zoom in for detail.'), h('span', 'spacer'), btn('↶ Undo', undo));
  }
}
export function syncBrushUI() { const i = $('#brushSize'), o = $('#brushOut'); if (i) i.value = S.brush; if (o) o.textContent = S.brush + ' px'; }
export function updateHint() {
  if (S.tool !== 'move') return;
  const el = $('#optbar .muted'); if (!el) return;
  if (!G.photo) el.textContent = 'Open one or more photos to get started. The preview shows how the objects will move.';
  else if (!G.photo.hasCutout) el.textContent = 'Tip: run ✨ Magic cutout (Cutout tab) so objects can go behind you.';
  else el.textContent = 'Drag on the photo to move the selected layer. For rings and clouds, drag the white dots to resize and tilt.';
}
