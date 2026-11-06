// Orbit Studio entry point: wires up the UI and runs the animation loop.
//
// Module map
//   util.js        DOM / math / color helpers
//   state.js       shared state (S = design, G = runtime)
//   presets.js     layer defaults, built-in presets, saved presets (localStorage)
//   shapes.js      procedural hand-drawn shapes
//   elements.js    layer → animated elements, drawing one element
//   render.js      compositing, cutout/outline caches, Instagram frame, export sizing
//   viewport.js    zoom / pan / canvas sizing
//   tools.js       Move, Hand, Zoom, Crop, cutout brushes, options bar
//   photos.js      multiple photos + film strip
//   cutout.js      background-removal queue + mask undo
//   panels.js      side-panel UI (layers, presets, look, frame, export settings)
//   colorpicker.js custom color popover
//   draw.js        draw-your-own pad with brushes
//   export.js      PNG / GIF / video / zip export

import { $, $$ } from './util.js';
import { S, G, ctx } from './state.js';
import { newGroup } from './presets.js';
import { renderOut } from './render.js';
import { fitView, zoomStep, zoom100, refreshCanvas } from './viewport.js';
import { setTool, keys, updateCursor, applyCrop, cancelCrop, syncBrushUI } from './tools.js';
import { addFiles, addImage, activate } from './photos.js';
import { requestCutout, cutoutAll, undo, clearCutout } from './cutout.js';
import { refreshAll, buildPresets, buildLook, buildCutoutPane, buildExportPane, buildFramePane, addLayer, saveCurrentAsPreset } from './panels.js';
import { loadUserPresets } from './presets.js';
import './draw.js';
import './export.js';

// ───────────────────────── animation loop
function frame(now) {
  if (S.playing) G.tNow = (now - G.t0) / 1000;
  renderOut(ctx, G.tNow, { guides: S.guides && !G.recording, full: S.tool === 'crop' });
  G.rec?.draw();
  requestAnimationFrame(frame);
}
function syncPlay() { $('#btnPlay').textContent = S.playing ? '❚❚ Pause' : '▶ Play'; }
document.addEventListener('playstate', syncPlay);
function togglePlay() { S.playing = !S.playing; if (S.playing) G.t0 = performance.now() - G.tNow * 1000; syncPlay(); }
function toggleFrame() { S.frame.on = !S.frame.on; buildFramePane(); refreshCanvas(); $('#btnFrame').classList.toggle('on', S.frame.on); }

// ───────────────────────── wiring
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.toggle('on', x === t));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t.dataset.tab));
});
$$('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#btnOpen').onclick = () => $('#file').click();
$('#dropCard').onclick = () => $('#file').click();
$('#file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('#btnExportTop').onclick = () => $('.tab[data-tab=export]').click();
$('#btnMagic').onclick = () => { if (!G.photo) { $('#file').click(); return; } requestCutout(G.photo, true); };
$('#btnCutAll').onclick = () => cutoutAll();
$('#btnUndo').onclick = $('#btnUndo2').onclick = undo;
$('#btnClearCut').onclick = clearCutout;
$('#btnPlay').onclick = togglePlay;
$('#btnGuides').onclick = e => { S.guides = !S.guides; e.currentTarget.classList.toggle('on', S.guides); };
$('#btnFrame').onclick = toggleFrame;
$('#zIn').onclick = () => zoomStep(1);
$('#zOut').onclick = () => zoomStep(-1);
$('#zFit').onclick = fitView;
$('#z100').onclick = zoom100;
$('#addLayer').onclick = addLayer;

// save-preset box
$('#btnSavePreset').onclick = () => {
  $('#saveBox').classList.remove('hidden'); $('#btnSavePreset').classList.add('hidden');
  const inp = $('#presetName'); inp.value = `My preset ${loadUserPresets().length + 1}`; inp.focus(); inp.select();
};
const closeSave = () => { $('#saveBox').classList.add('hidden'); $('#btnSavePreset').classList.remove('hidden'); };
$('#saveCancel').onclick = closeSave;
$('#saveOk').onclick = () => { if (saveCurrentAsPreset($('#presetName').value)) closeSave(); };
$('#presetName').onkeydown = e => { if (e.key === 'Enter') $('#saveOk').click(); else if (e.key === 'Escape') closeSave(); };

// drag & drop / paste
const stageEl = $('#stage');
['dragenter', 'dragover'].forEach(ev => stageEl.addEventListener(ev, e => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => stageEl.addEventListener(ev, e => { e.preventDefault(); $('#drop').classList.remove('over'); }));
stageEl.addEventListener('drop', e => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
window.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
  if (files.length) addFiles(files);
});

// keyboard shortcuts
window.addEventListener('keydown', e => {
  if (e.target.closest?.('input,select,textarea,dialog')) return;
  if (e.key === 'Alt') { keys.alt = true; updateCursor(); }
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); undo(); }
    else if (k === '=' || k === '+') { e.preventDefault(); zoomStep(1); }
    else if (k === '-') { e.preventDefault(); zoomStep(-1); }
    else if (k === '0') { e.preventDefault(); fitView(); }
    else if (k === '1') { e.preventDefault(); zoom100(); }
    return;
  }
  if (e.key === ' ') { e.preventDefault(); if (!keys.space) { keys.space = true; updateCursor(); } return; }
  if (e.key === 'Enter' && S.tool === 'crop') { e.preventDefault(); applyCrop(); return; }
  if (e.key === 'Escape' && S.tool === 'crop') { cancelCrop(); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { // switch photos
    const i = G.photos.indexOf(G.photo), j = i + (e.key === 'ArrowRight' ? 1 : -1);
    if (G.photos[j]) activate(G.photos[j]);
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'v' || k === 'm') setTool('move'); else if (k === 'h') setTool('hand'); else if (k === 'z') setTool('zoom');
  else if (k === 'c') setTool('crop'); else if (k === 'e') setTool('erase'); else if (k === 'r') setTool('restore');
  else if (k === 'p') togglePlay(); else if (k === 'f') toggleFrame();
  else if (k === '[') { S.brush = Math.max(4, Math.round(S.brush / 1.15)); syncBrushUI(); }
  else if (k === ']') { S.brush = Math.min(300, Math.round(S.brush * 1.15) + 1); syncBrushUI(); }
});
window.addEventListener('keyup', e => {
  if (e.key === ' ') { keys.space = false; updateCursor(); }
  if (e.key === 'Alt') { keys.alt = false; updateCursor(); }
});
window.addEventListener('blur', () => { keys.space = keys.alt = false; });

// ───────────────────────── boot
S.groups.push(newGroup());
refreshAll(); buildPresets(); buildLook(); buildCutoutPane(); buildExportPane(); buildFramePane();
activate(null); syncPlay();
requestAnimationFrame(frame);
window.app = { S, G, addFiles, addImage, activate }; // handy for debugging in the console
