// Exports: PNG still, GIF, video (MediaRecorder), and "Export all photos" as a zip.
// With the Instagram frame on, every export is exactly the chosen Instagram size.

import { $, mk, toast, download, canvasToBlob, sleep } from './util.js';
import { S, G } from './state.js';
import { renderExport, exportSize } from './render.js';
import { activate } from './photos.js';
import { requestCutout } from './cutout.js';

const GIFENC_URL = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm';
const FFLATE_URL = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';

const status = t => { $('#exportStatus').textContent = t; };
const safeName = p => (p?.name || 'orbit').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
function busy(on, text, pct) {
  $('#busy').classList.toggle('hidden', !on);
  if (text != null) $('#busyText').textContent = text;
  $('#busyBar').style.width = (pct == null ? 0 : Math.round(pct * 100)) + '%';
  $('#busyBar').parentElement.style.visibility = pct == null ? 'hidden' : 'visible';
}
function videoMime() {
  const types = ['video/mp4;codecs=avc1.42E01F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || null;
}

export async function pngBlob() {
  const d = exportSize(), c = mk(d.w, d.h);
  renderExport(c.getContext('2d'), G.tNow, d);
  return canvasToBlob(c);
}
export async function gifBlob(onProgress) {
  const { GIFEncoder, quantize, applyPalette } = await import(GIFENC_URL);
  const d0 = exportSize(), gw = Math.min(S.gif.width, d0.w), k = gw / d0.w, gh = Math.round(d0.h * k);
  const d = { w: gw, h: gh, sx: d0.sx * k, sy: d0.sy * k };
  const c = mk(gw, gh), x = c.getContext('2d', { willReadFrequently: true });
  const fps = S.gif.fps, n = Math.round(S.loop * fps), gif = GIFEncoder();
  G.snapLen = S.loop;
  try {
    for (let i = 0; i < n; i++) {
      x.fillStyle = '#000'; x.fillRect(0, 0, gw, gh);
      renderExport(x, i / fps, d);
      const data = x.getImageData(0, 0, gw, gh).data, pal = quantize(data, 256), idx = applyPalette(data, pal);
      gif.writeFrame(idx, gw, gh, { palette: pal, delay: Math.round(1000 / fps) });
      if (i % 3 === 0) { onProgress?.(i / n); await sleep(0); }
    }
  } finally { G.snapLen = 0; }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
/** Records in real time from an offscreen canvas at the exact export size. */
export async function videoBlob(onProgress) {
  const mime = videoMime(); if (!mime) throw new Error('Video recording isn\'t supported in this browser. Try GIF.');
  const d = exportSize(), w = Math.round(d.w / 2) * 2, hh = Math.round(d.h / 2) * 2; // encoders want even sizes
  const dims = { w, h: hh, sx: d.sx * w / d.w, sy: d.sy * hh / d.h };
  const rc = mk(w, hh), rx = rc.getContext('2d');
  const rec = new MediaRecorder(rc.captureStream(30), { mimeType: mime, videoBitsPerSecond: 12e6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  G.snapLen = S.loop; G.recording = true; S.playing = true; document.dispatchEvent(new Event('playstate'));
  G.t0 = performance.now(); G.tNow = 0;
  G.rec = { draw: () => { rx.fillStyle = '#000'; rx.fillRect(0, 0, w, hh); renderExport(rx, G.tNow, dims); } };
  G.rec.draw();
  rec.start(250);
  const total = S.loop * S.video.loops, start = performance.now();
  try {
    while ((performance.now() - start) / 1000 < total + 0.12) { onProgress?.(Math.min(1, (performance.now() - start) / 1000 / total)); await sleep(150); }
    rec.stop(); await done;
  } finally { G.rec = null; G.recording = false; G.snapLen = 0; }
  return { blob: new Blob(chunks, { type: mime }), ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}

async function run(btn, fn) {
  if (G.exporting) return;
  if (!G.photo) { toast('Open a photo first.'); return; }
  G.exporting = true; btn.disabled = true;
  try { await fn(); } catch (e) { console.error(e); status('Export failed: ' + (e.message || e)); }
  G.exporting = false; btn.disabled = false;
}
$('#btnPng').onclick = e => run(e.currentTarget, async () => { download(await pngBlob(), `${safeName(G.photo)}.png`); status('✓ PNG saved.'); });
$('#btnGif').onclick = e => run(e.currentTarget, async () => {
  status('Encoding GIF…');
  download(await gifBlob(p => status(`Encoding GIF… ${Math.round(p * 100)}%`)), `${safeName(G.photo)}.gif`); status('✓ GIF saved.');
});
$('#btnVideo').onclick = e => run(e.currentTarget, async () => {
  if (S.bg.mode === 'none' && !S.frame.on) toast('Transparent background will show as black in video.');
  const total = S.loop * S.video.loops;
  const { blob, ext } = await videoBlob(p => status(`Recording… ${(p * total).toFixed(1)} / ${total} s`));
  download(blob, `${safeName(G.photo)}.${ext}`); status('✓ Video saved.');
});

/** Export every open photo with the shared style into one zip. */
export async function exportAll() {
  const photos = G.photos.slice(); if (!photos.length) { toast('Open some photos first.'); return; }
  if (G.exporting) return;
  G.exporting = true;
  const fmt = S.batch.format, prev = G.photo, files = {}, n = photos.length;
  try {
    const { zipSync } = await import(FFLATE_URL);
    for (let i = 0; i < n; i++) {
      const p = photos[i], label = `Photo ${i + 1} of ${n}`;
      activate(p);
      if (S.autoCutout && !p.hasCutout) { busy(true, `${label}: cutting out…`, i / n); await requestCutout(p, true); }
      busy(true, `${label}: exporting…`, i / n);
      await sleep(30);
      let blob, ext = fmt === 'video' ? 'mp4' : fmt;
      if (fmt === 'png') blob = await pngBlob();
      else if (fmt === 'gif') blob = await gifBlob(f => busy(true, `${label}: encoding GIF ${Math.round(f * 100)}%`, (i + f) / n));
      else ({ blob, ext } = await videoBlob(f => busy(true, `${label}: recording ${Math.round(f * 100)}%`, (i + f) / n)));
      files[`${String(i + 1).padStart(2, '0')}-${safeName(p)}.${ext}`] = new Uint8Array(await blob.arrayBuffer());
    }
    busy(true, 'Packing zip…', 1);
    const zip = zipSync(files, { level: 0 }); // images/videos are already compressed
    download(new Blob([zip], { type: 'application/zip' }), `orbit-${fmt}-${n}-photos.zip`);
    status(`✓ Exported ${n} photos.`);
  } catch (e) { console.error(e); status('Export failed: ' + (e.message || e)); }
  finally { busy(false); G.exporting = false; if (prev && G.photos.includes(prev)) activate(prev); }
}
$('#btnExportAll').onclick = exportAll;
