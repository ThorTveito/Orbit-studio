// Multiple photos: each has its own image, cutout mask, crop and undo history. Layers, look and the
// Instagram frame are shared, so a whole carousel gets one consistent style.

import { $, h, mk, toast, blobToImage } from './util.js';
import { S, G, syncGeometry, resizeCaches } from './state.js';
import { refreshCanvas } from './viewport.js';
import { setTool, updateHint } from './tools.js';
import { requestCutout, updateCutStatus } from './cutout.js';

const MAX_SIDE = 2160; // working resolution: plenty for 1080-wide Instagram exports at 2×
let pid = 1;

function makePhoto(im, name) {
  const w0 = im.naturalWidth || im.width, h0 = im.naturalHeight || im.height;
  const s = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(2, Math.round(w0 * s / 2) * 2), hh = Math.max(2, Math.round(h0 * s / 2) * 2);
  const img = mk(w, hh); img.getContext('2d').drawImage(im, 0, 0, w, hh);
  const th = mk(Math.round(64 * w / hh), 64); th.getContext('2d').drawImage(img, 0, 0, th.width, th.height);
  return { id: pid++, name: (name || 'photo').replace(/\.[^.]+$/, ''), img, mask: mk(w, hh), thumb: th, hasCutout: false, cutState: 'new', crop: { x: 0, y: 0, w, h: hh }, undo: [] };
}

/** Open one or many image files. The first new photo becomes active. */
export async function addFiles(files) {
  const list = [...files].filter(f => f && f.type && f.type.startsWith('image/'));
  if (!list.length) { toast('That doesn\'t look like an image.'); return; }
  const added = [];
  for (const f of list) {
    try { added.push(makePhoto(await blobToImage(f), f.name)); }
    catch (e) { console.error(e); toast(`Could not open ${f.name} (try JPG or PNG).`); }
  }
  if (!added.length) return;
  G.photos.push(...added);
  activate(added[0]);
  if (added.length > 1) toast(`Opened ${added.length} photos. Switch between them in the strip below.`);
  if (S.autoCutout) added.forEach((p, i) => requestCutout(p, i === 0));
}
/** Also used for programmatic loads (canvas / image). */
export function addImage(im, name) { const p = makePhoto(im, name); G.photos.push(p); activate(p); if (S.autoCutout) requestCutout(p, true); return p; }

export function activate(p) {
  G.photo = p || null;
  syncGeometry(); resizeCaches();
  if (S.tool === 'crop') S.tool = 'move';
  $('#drop').classList.toggle('hidden', !!p);
  setTool(S.tool); refreshCanvas();
  updateCutStatus(); updateHint(); renderStrip();
}
export function removePhoto(p) {
  const i = G.photos.indexOf(p); if (i < 0) return;
  G.photos.splice(i, 1);
  if (G.photo === p) activate(G.photos[Math.min(i, G.photos.length - 1)] || null);
  else renderStrip();
}

const BADGE = { cutting: '✂…', queued: '⋯', failed: '!' };
export function renderStrip() {
  const el = $('#strip'); el.innerHTML = '';
  el.classList.toggle('hidden', !G.photos.length);
  if (!G.photos.length) return;
  G.photos.forEach((p, i) => {
    const t = h('button', 'thumb' + (p === G.photo ? ' on' : ''));
    t.type = 'button'; t.title = `${i + 1}. ${p.name}`;
    // the strip is rebuilt often and a canvas can only live in one place, so draw a fresh copy
    const c = mk(p.thumb.width, p.thumb.height); c.getContext('2d').drawImage(p.thumb, 0, 0); t.append(c);
    const badge = p.hasCutout ? '✓' : BADGE[p.cutState];
    if (badge) t.append(h('span', 'badge' + (p.cutState === 'cutting' ? ' busy' : ''), badge));
    t.append(h('span', 'num', String(i + 1)));
    const x = h('span', 'x', '✕'); x.title = 'Remove photo';
    x.onclick = e => { e.stopPropagation(); removePhoto(p); };
    t.append(x);
    t.onclick = () => { if (p !== G.photo) activate(p); };
    el.append(t);
  });
  const add = h('button', 'addthumb', '+'); add.type = 'button'; add.title = 'Add photos';
  add.onclick = () => $('#file').click();
  el.append(add, h('span', 'stripinfo', `${G.photos.length} photo${G.photos.length > 1 ? 's' : ''} · shared style`));
}
