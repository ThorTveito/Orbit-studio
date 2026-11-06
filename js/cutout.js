// Magic cutout (on-device background removal) with a background queue, so several photos can be
// cut out one after another without blocking the editor. Plus mask undo for the touch-up brushes.

import { $, mk, toast, blobToImage, canvasToBlob } from './util.js';
import { S, G, dirty } from './state.js';
import { renderStrip } from './photos.js';
import { updateHint } from './tools.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const DATA_URL = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
let mod = null;
const queue = [];
let running = false;

/** Small status pill in the status bar. */
function pill(text) { const el = $('#jobPill'); el.classList.toggle('hidden', !text); el.textContent = text || ''; }

/** Queue a photo for cutout. Resolves when that photo is done (or failed). */
export function requestCutout(p, first = false) {
  if (!p) return Promise.resolve();
  if (p.cutState === 'cutting' || p.cutState === 'queued') {
    if (first && p.cutState === 'queued') { queue.splice(queue.indexOf(p), 1); queue.unshift(p); }
    return p.cutPromise;
  }
  p.cutState = 'queued';
  p.cutPromise = new Promise(res => { p._cutDone = res; });
  first ? queue.unshift(p) : queue.push(p);
  renderStrip(); updateCutStatus(); pump();
  return p.cutPromise;
}
export const cutoutAll = () => Promise.all(G.photos.filter(p => !p.hasCutout).map(p => requestCutout(p)));

async function pump() {
  if (running) return; running = true;
  while (queue.length) {
    const p = queue.shift();
    if (!G.photos.includes(p)) { p._cutDone?.(); continue; }
    p.cutState = 'cutting'; renderStrip(); updateCutStatus();
    const label = G.photos.length > 1 ? `photo ${G.photos.indexOf(p) + 1} of ${G.photos.length}` : 'your photo';
    try {
      await runCutout(p, label);
      p.cutState = 'done';
    } catch (e) {
      console.error(e); p.cutState = 'failed'; toast('Cutout failed: ' + (e.message || e), 5000);
    }
    p._cutDone?.(); renderStrip(); updateCutStatus(); updateHint();
  }
  running = false; pill(null);
}

async function runCutout(p, label) {
  pill(`✂ Loading cutout model…`);
  mod ??= await import(MODEL_URL);
  const out = await mod.removeBackground(await canvasToBlob(p.img), {
    publicPath: DATA_URL, model: S.quality,
    output: { format: 'image/png', type: 'foreground' },
    progress: (key, cur, total) => {
      if (key.startsWith('fetch')) pill(`⬇ Downloading cutout model (first time only) ${total ? Math.round(cur / total * 100) : 0}%`);
      else pill(`✂ Cutting out ${label}…`);
    },
  });
  const im = await blobToImage(out);
  pushUndo(p);
  const { width: w, height: h } = p.img, m = p.mask.getContext('2d', { willReadFrequently: true });
  m.clearRect(0, 0, w, h); m.drawImage(im, 0, 0, w, h);
  const md = m.getImageData(0, 0, w, h), d = md.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 24) d[i] = 0; // drop near-invisible background noise
  m.putImageData(md, 0, 0);
  p.hasCutout = true;
  if (p === G.photo) dirty.cut = true;
}

// ── undo for the mask (per photo)
export function pushUndo(p = G.photo) {
  if (!p) return;
  const s = mk(p.mask.width, p.mask.height); s.getContext('2d').drawImage(p.mask, 0, 0);
  p.undo.push({ mask: s, has: p.hasCutout }); if (p.undo.length > 20) p.undo.shift();
}
export function undo() {
  const p = G.photo, u = p?.undo.pop(); if (!u) { toast('Nothing to undo'); return; }
  const m = p.mask.getContext('2d'); m.clearRect(0, 0, p.mask.width, p.mask.height); m.drawImage(u.mask, 0, 0);
  p.hasCutout = u.has; dirty.cut = true; updateCutStatus(); renderStrip();
}
export function clearCutout() {
  const p = G.photo; if (!p) return;
  pushUndo(p); p.mask.getContext('2d').clearRect(0, 0, p.mask.width, p.mask.height);
  p.hasCutout = false; p.cutState = 'new'; dirty.cut = true; updateCutStatus(); updateHint(); renderStrip();
}
export function updateCutStatus() {
  const el = $('#cutStatus'), p = G.photo;
  el.textContent = !p ? 'Open a photo first.'
    : p.cutState === 'cutting' ? '✂ Cutting out this photo…'
    : p.cutState === 'queued' ? 'Waiting in line for a cutout…'
    : p.hasCutout ? '✓ Cutout active. Objects can pass behind the subject.'
    : 'No cutout yet. Objects will only appear on top.';
  el.classList.toggle('good', !!p?.hasCutout);
  const n = G.photos.filter(x => !x.hasCutout).length;
  $('#btnCutAll').classList.toggle('hidden', G.photos.length < 2);
  $('#btnCutAll').textContent = n ? `✨ Cut out all photos (${n} left)` : '✓ All photos cut out';
  $('#btnCutAll').disabled = !n;
}
