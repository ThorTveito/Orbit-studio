// Photoshop-style viewport: the canvas sits in the stage with a CSS transform for zoom and pan.

import { $, clamp } from './util.js';
import { S, G, canvas } from './state.js';
import { frameLayout, exportSize } from './render.js';

export const stage = $('#stage');
export const view = { zoom: 1, x: 0, y: 0, fit: true };

/** Size the editor canvas: whole photo while cropping, the frame when it's on, else the crop. */
export function sizeCanvas() {
  const L = S.tool !== 'crop' && frameLayout();
  const w = S.tool === 'crop' ? G.SW : L ? L.FW : G.W, hh = S.tool === 'crop' ? G.SH : L ? L.FH : G.H;
  const changed = canvas.width !== w || canvas.height !== hh;
  if (changed) { canvas.width = w; canvas.height = hh; }
  canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
  return changed;
}
/** Offset of the photo inside the editor canvas (non-zero when the frame is on). */
export function sceneOffset() {
  const L = S.tool !== 'crop' && frameLayout();
  return L ? { x: L.ox, y: L.oy } : { x: 0, y: 0 };
}
export function canvasScale() { const r = canvas.getBoundingClientRect(); return r.width ? canvas.width / r.width : 1; }

export function applyView() {
  canvas.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.zoom})`;
  $('#zoomVal').textContent = (view.zoom < 0.1 ? (view.zoom * 100).toFixed(1) : Math.round(view.zoom * 100)) + '%';
}
export function fitView() {
  const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return;
  const pad = 28, z = Math.min((r.width - pad * 2) / canvas.width, (r.height - pad * 2) / canvas.height);
  view.zoom = clamp(z, 0.02, 8); view.x = (r.width - canvas.width * view.zoom) / 2; view.y = (r.height - canvas.height * view.zoom) / 2;
  view.fit = true; applyView();
}
function clampView() {
  const r = stage.getBoundingClientRect(), cw = canvas.width * view.zoom, ch = canvas.height * view.zoom, m = 80;
  view.x = clamp(view.x, Math.min(m - cw, (r.width - cw) / 2), Math.max(r.width - m, (r.width - cw) / 2));
  view.y = clamp(view.y, Math.min(m - ch, (r.height - ch) / 2), Math.max(r.height - m, (r.height - ch) / 2));
}
export function zoomAt(z, sx, sy) {
  const r = stage.getBoundingClientRect();
  if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
  z = clamp(z, 0.02, 32);
  const wx = (sx - view.x) / view.zoom, wy = (sy - view.y) / view.zoom;
  view.zoom = z; view.x = sx - wx * z; view.y = sy - wy * z; view.fit = false;
  clampView(); applyView();
}
const ZSTEPS = [0.05, 0.0833, 0.125, 0.1667, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 32];
export const zoomStep = dir => zoomAt(dir > 0 ? (ZSTEPS.find(s => s > view.zoom * 1.01) ?? 32) : ([...ZSTEPS].reverse().find(s => s < view.zoom / 1.01) ?? 0.02));
export const zoom100 = () => zoomAt(1);
export function panBy(dx, dy) { view.x += dx; view.y += dy; view.fit = false; clampView(); applyView(); }
new ResizeObserver(() => { if (view.fit) fitView(); else { clampView(); applyView(); } }).observe(stage);

/** Re-size + re-fit after anything that changes the canvas size (photo, crop, frame). */
export function refreshCanvas() { sizeCanvas(); fitView(); updateDims(); }

export function updateDims() {
  const p = G.photo, el = $('#dims');
  if (!p) { el.textContent = ''; return; }
  const cropped = p.crop.w !== G.SW || p.crop.h !== G.SH;
  const photo = `${G.W} × ${G.H} px${cropped ? ' (cropped)' : ''}`;
  if (S.frame.on) { const e = exportSize(); el.textContent = `Instagram ${e.w} × ${e.h} · photo ${photo}`; }
  else el.textContent = photo;
}
