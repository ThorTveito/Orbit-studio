// "Draw your own object" pad with expressive brushes.
//
// Strokes are stored as data (points + pressure/speed + brush + seed), not pixels. That lets us:
//  • re-open and edit a drawing later,
//  • save it compactly in presets,
//  • render 3 slightly different hand-redrawn variants (jittered lines, re-rolled grain) that the
//    layer flips between when "boil" is on – the classic hand-drawn animation shimmer.

import { $, $$, h, mk, rng, clamp, lerp, TAU, toast, newSeed, blobToImage } from './util.js';
import { S, curG } from './state.js';
import { newGroup } from './presets.js';
import { smoothClosed } from './shapes.js';
import { refreshAll } from './panels.js';
import { colorButton } from './colorpicker.js';

const PAD = 900;                     // internal pad resolution (pad units)
const PEN_COLORS = ['#111111', '#ffffff', '#e8141b', '#ff5fa2', '#ffd23f', '#3ddc97', '#2b6bff', '#8b7bff'];
export const BRUSHES = [
  { id: 'pen', name: 'Pen', tip: 'Smooth, even line' },
  { id: 'ink', name: 'Ink brush', tip: 'Thick when slow, thin when fast, tapered ends. Uses pen pressure.' },
  { id: 'marker', name: 'Marker', tip: 'Wide, slightly see-through felt tip' },
  { id: 'pencil', name: 'Pencil', tip: 'Grainy graphite line' },
  { id: 'crayon', name: 'Crayon', tip: 'Waxy, textured stroke' },
  { id: 'spray', name: 'Spray', tip: 'Speckled spray paint' },
  { id: 'eraser', name: 'Eraser', tip: 'Erase parts of your drawing' },
];

const pad = $('#drawPad'), pctx = pad.getContext('2d');
pad.width = pad.height = PAD;
const pen = { brush: 'ink', size: 18, color: '#111111', fill: true };
let strokes = [], cur = null, editing = null, last = null;
const committed = mk(PAD, PAD), cctx = committed.getContext('2d');
const tmp = mk(PAD, PAD), tctx = tmp.getContext('2d');

// ───────────────────────── stroke rendering
const grains = [];
/** Waxy grain texture used to punch holes into crayon strokes (one per variant). */
function grain(v) {
  if (grains[v]) return grains[v];
  const n = PAD / 2, g = mk(n, n), x = g.getContext('2d'), id = x.createImageData(n, n), r = rng(777 + v * 31);
  for (let i = 0; i < n * n; i++) { id.data[i * 4 + 3] = r() < 0.2 ? 0 : 120 + r() * 135; }
  x.putImageData(id, 0, 0);
  const full = mk(PAD, PAD), fx = full.getContext('2d'); fx.drawImage(g, 0, 0, PAD, PAD);
  return (grains[v] = full);
}
/** Smoothly displace points: random offsets at every 8th point, eased in between. */
function jitter(pts, amp, seed) {
  const r = rng(seed), step = 8, knots = [];
  for (let k = 0; k <= Math.ceil(pts.length / step) + 1; k++) knots.push([(r() - .5) * 2 * amp, (r() - .5) * 2 * amp]);
  return pts.map((p, i) => {
    const k = Math.floor(i / step), f = (i % step) / step, e = f * f * (3 - 2 * f);
    return { x: p.x + lerp(knots[k][0], knots[k + 1][0], e), y: p.y + lerp(knots[k][1], knots[k + 1][1], e), p: p.p };
  });
}
function smoothPath(pts, close) {
  const p = new Path2D(); p.moveTo(pts[0].x, pts[0].y);
  if (pts.length < 3) { const l = pts[pts.length - 1]; p.lineTo(l.x + 0.01, l.y); return p; }
  for (let i = 1; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; p.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
  const l = pts[pts.length - 1]; p.lineTo(l.x, l.y);
  if (close) p.closePath();
  return p;
}
const isClosed = s => s.fill && s.pts.length > 8 && Math.hypot(s.pts[0].x - s.pts[s.pts.length - 1].x, s.pts[0].y - s.pts[s.pts.length - 1].y) < PAD * 0.06;
/** Each segment of the polyline, sampled every `step` units. */
function walk(pts, step, fn) {
  if (pts.length === 1) { fn(pts[0].x, pts[0].y, pts[0].p ?? 1); return; }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) { const t = k / n; fn(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, lerp(a.p ?? 1, b.p ?? 1, t)); }
  }
}
/** Variable-width ink outline: offset the path along its normals by a pressure/speed width. */
function inkPath(pts, size) {
  const n = pts.length; if (n < 2) { const p = new Path2D(); p.arc(pts[0].x, pts[0].y, size * 0.3, 0, TAU); return p; }
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const taper = Math.min(1, (i + 1) / 7, (n - i) / 7);
    const w = size * 0.5 * (pts[i].p ?? 1) * (0.15 + 0.85 * taper);
    L.push([pts[i].x - dy / len * w, pts[i].y + dx / len * w]); R.push([pts[i].x + dy / len * w, pts[i].y - dx / len * w]);
  }
  return smoothClosed([...L, ...R.reverse()]);
}
export function renderStroke(c, s, v = 0) {
  const pts = v ? jitter(s.pts, Math.max(1.6, s.size * 0.09), s.seed + v * 7919) : s.pts;
  const r = rng(s.seed + v * 104729), size = s.size, closed = isClosed(s);
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = s.color;
  switch (s.brush) {
    case 'pen':
      if (closed) c.fill(smoothPath(pts, true));
      c.lineWidth = size * 0.7; c.stroke(smoothPath(pts));
      break;
    case 'ink':
      if (closed) c.fill(smoothPath(pts, true));
      c.fill(inkPath(pts, size * 1.3));
      break;
    case 'marker':
      c.globalAlpha = 0.82; c.lineCap = 'butt'; c.lineWidth = size * 1.5;
      if (closed) c.fill(smoothPath(pts, true));
      c.stroke(smoothPath(pts));
      break;
    case 'pencil': {
      const w = Math.max(2.5, size * 0.35);
      walk(pts, 1.1, (x, y, p) => { for (let k = 0; k < 3; k++) { c.globalAlpha = (0.15 + r() * 0.5) * clamp(p, 0.4, 1.2); const d = 0.7 + r() * 1.4; c.fillRect(x + (r() - .5) * w, y + (r() - .5) * w, d, d); } });
      break;
    }
    case 'crayon':
      tctx.clearRect(0, 0, PAD, PAD); tctx.save();
      tctx.lineCap = 'round'; tctx.lineJoin = 'round'; tctx.strokeStyle = tctx.fillStyle = s.color; tctx.lineWidth = size * 1.15;
      if (closed) tctx.fill(smoothPath(pts, true));
      tctx.stroke(smoothPath(pts));
      tctx.lineWidth = size * 0.5; tctx.stroke(smoothPath(jitter(pts, size * 0.25, s.seed + 3 + v))); // ragged edge
      tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(grain(v), 0, 0);
      tctx.restore();
      c.drawImage(tmp, 0, 0);
      break;
    case 'spray':
      walk(pts, Math.max(2, size * 0.25), (x, y) => { for (let k = 0; k < 7; k++) { const a = r() * TAU, d = size * 1.2 * Math.sqrt(r()), dot = 1 + r() * 1.3; c.globalAlpha = 0.55 + r() * 0.4; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, dot, dot); } });
      break;
    case 'eraser':
      c.globalCompositeOperation = 'destination-out'; c.lineWidth = size * 1.4; c.stroke(smoothPath(pts));
      break;
  }
  c.restore();
}

// ───────────────────────── pad interaction
function redrawCommitted() { cctx.clearRect(0, 0, PAD, PAD); for (const s of strokes) renderStroke(cctx, s); }
function redrawLive() { pctx.clearRect(0, 0, PAD, PAD); pctx.drawImage(committed, 0, 0); if (cur) renderStroke(pctx, cur); }
function padPoint(e) {
  const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) * PAD / r.width, y = (e.clientY - r.top) * PAD / r.height;
  let p;
  if (e.pointerType === 'pen' && e.pressure > 0) p = 0.25 + e.pressure * 1.1;
  else { // simulate pressure from speed: slow = thick, fast = thin
    const now = e.timeStamp, v = last ? Math.hypot(x - last.x, y - last.y) / Math.max(1, now - last.t) : 0;
    const target = clamp(1.3 - v * 0.22, 0.3, 1.3);
    p = last ? last.p * 0.7 + target * 0.3 : 1;
    last = { x, y, t: now, p };
  }
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, p: Math.round(p * 100) / 100 };
}
pad.addEventListener('pointerdown', e => {
  pad.setPointerCapture(e.pointerId); last = null;
  cur = { brush: pen.brush, size: pen.size, color: pen.color, fill: pen.fill, seed: newSeed(), pts: [padPoint(e)] };
  redrawLive();
});
pad.addEventListener('pointermove', e => {
  if (!cur) return;
  const evs = e.getCoalescedEvents?.() || [];
  for (const ev of (evs.length ? evs : [e])) cur.pts.push(padPoint(ev));
  redrawLive();
});
const finish = () => { if (!cur) return; strokes.push(cur); renderStroke(cctx, cur); cur = null; redrawLive(); };
pad.addEventListener('pointerup', finish);
pad.addEventListener('pointercancel', finish);

function undoStroke() { strokes.pop(); redrawCommitted(); redrawLive(); }

// ───────────────────────── dialog UI
function brushPreview(b) {
  const c = mk(240, 64), x = c.getContext('2d'), pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push({ x: 18 + t * 204, y: 32 + Math.sin(t * TAU * 1.1) * 14, p: 1.25 - 0.8 * Math.sin(t * Math.PI) }); }
  if (b.id === 'eraser') { x.fillStyle = '#9a9aa8'; x.fillRect(10, 18, 220, 28); }
  renderStroke(x, { brush: b.id, size: 11, color: '#ececf1', fill: false, seed: 42, pts });
  return c;
}
function buildBrushUI() {
  const box = $('#brushes'); box.innerHTML = '';
  for (const b of BRUSHES) {
    const btn = h('button', 'bbtn' + (pen.brush === b.id ? ' on' : ''), [brushPreview(b), h('span', null, b.name)]);
    btn.type = 'button'; btn.title = b.tip;
    btn.onclick = () => { pen.brush = b.id; buildBrushUI(); };
    box.append(btn);
  }
  const cols = $('#penColors'); cols.innerHTML = '';
  for (const c of PEN_COLORS) {
    const s = h('button', 'pcol' + (pen.color === c ? ' on' : '')); s.type = 'button'; s.style.background = c; s.title = c;
    s.onclick = () => { pen.color = c; buildBrushUI(); };
    cols.append(s);
  }
  const custom = colorButton(pen, 'color', () => $$('#penColors .pcol').forEach(x => x.classList.remove('on')));
  custom.classList.add('pcustom'); custom.title = 'Any color';
  cols.append(custom);
}
$('#penSize').oninput = e => { pen.size = +e.target.value; };
$('#penFill').onchange = e => { pen.fill = e.target.checked; };
$('#padBg').onclick = () => pad.classList.toggle('dark');
$('#drawUndo').onclick = undoStroke;
$('#drawClear').onclick = () => { strokes = []; redrawCommitted(); redrawLive(); };
$('#drawCancel').onclick = () => $('#drawDlg').close();
$('#drawUse').onclick = () => {
  if (!strokes.some(s => s.brush !== 'eraser')) { toast('Draw something first ✍️'); return; }
  let g = editing || curG();
  if (!g) { g = newGroup(); S.groups.push(g); S.sel = S.groups.length - 1; }
  if (!setDrawing(g, strokes.map(s => ({ ...s, pts: s.pts.slice() })))) { toast('Your drawing is empty (all erased?)'); return; }
  // One ink color → recolor with the layer color (set to that ink). Several colors → keep them.
  const colors = [...new Set(strokes.filter(s => s.brush !== 'eraser').map(s => s.color))];
  if (colors.length === 1) { g.tint = true; g.color = colors[0]; } else g.tint = false;
  $('#drawDlg').close(); refreshAll();
  toast(editing ? 'Drawing updated ✦' : 'Your drawing is in ✦ (it boils like hand-drawn animation)');
};
$('#drawDlg').addEventListener('keydown', e => {
  if (e.target.closest?.('input[type=text]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoStroke(); }
  else if (e.key === '[') { pen.size = Math.max(2, pen.size - 2); $('#penSize').value = pen.size; }
  else if (e.key === ']') { pen.size = Math.min(80, pen.size + 2); $('#penSize').value = pen.size; }
});

/** Open the pad. Pass a layer to edit its existing drawing. */
export function openDraw(g = null) {
  editing = g && g.strokes ? g : null;
  strokes = editing ? editing.strokes.map(s => ({ ...s, pts: s.pts.slice() })) : [];
  $('#drawTitle').textContent = editing ? 'Edit your drawing' : 'Draw your own object';
  $('#penSize').value = pen.size; $('#penFill').checked = pen.fill;
  buildBrushUI(); redrawCommitted(); redrawLive();
  $('#drawDlg').showModal();
}

// ───────────────────────── turning strokes into layer images
/** Render 3 hand-redrawn variants of a drawing, all cropped to the same box. */
export function drawingVariants(list) {
  const cv = [0, 1, 2].map(v => { const c = mk(PAD, PAD), x = c.getContext('2d'); for (const s of list) renderStroke(x, s, v); return c; });
  let x0 = PAD, y0 = PAD, x1 = -1, y1 = -1;
  for (const c of cv) {
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, PAD, PAD).data;
    for (let y = 0; y < PAD; y++) for (let x = 0; x < PAD; x++) if (d[(y * PAD + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(PAD - 1, x1 + m); y1 = Math.min(PAD - 1, y1 + m);
  return cv.map(c => { const o = mk(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o; });
}
/** Give a layer a drawing (strokes → variants). Returns false if the drawing is empty. */
export function setDrawing(g, list) {
  const vars = drawingVariants(list); if (!vars) return false;
  g.strokes = list; g.customVariants = vars; g.customImg = vars[0]; g._tints = new Map(); g.shape = 'custom';
  return true;
}

// ───────────────────────── uploaded PNG objects
function trimCanvas(src) {
  const { width: w, height: hgt } = src, d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, hgt).data;
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const p = 4, o = mk(x1 - x0 + 1 + p * 2, y1 - y0 + 1 + p * 2); o.getContext('2d').drawImage(src, x0 - p, y0 - p, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
$('#customFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const im = await blobToImage(f), s = Math.min(1, 900 / Math.max(im.width, im.height));
  const c = mk(Math.round(im.width * s), Math.round(im.height * s)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  let g = curG(); if (!g) { g = newGroup(); S.groups.push(g); S.sel = S.groups.length - 1; }
  Object.assign(g, { customImg: trimCanvas(c) || c, customVariants: null, strokes: null, _tints: new Map(), shape: 'custom' });
  refreshAll(); toast('Your image is in ✦');
};
