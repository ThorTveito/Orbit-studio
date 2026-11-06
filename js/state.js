// Shared application state.
//
//  S  – everything the user designs: layers, look, frame, export settings, current tool.
//       Shared across all open photos, so a carousel keeps one consistent style.
//  G  – runtime state: the open photos, geometry of the ACTIVE photo, clock, export flags.
//
// Geometry of the active photo (all in working-image pixels):
//   SW×SH = full uncropped photo, W×H = the cropped frame, D = min(W, H) (sizes are relative to D).

import { mk } from './util.js';

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d');

export const S = {
  quality: 'isnet_fp16', autoCutout: true, feather: 1,
  bg: { mode: 'original', blur: 14, dim: 0.35, color: '#efe9df', color2: '#b9a8ff' },
  subject: { look: 'original', outline: 0, outlineColor: '#ffffff', shadow: 0, glow: 0, glowColor: '#ffffff' },
  frame: { on: false, aspect: '4:5', color: '#ffffff', pad: 0.04, radius: 0, size: 1080 },
  loop: 4, playing: true, guides: true,
  groups: [], sel: 0, tool: 'move', brush: 40,
  video: { loops: 2 }, gif: { width: 480, fps: 20 }, batch: { format: 'png' },
};

export const G = {
  photos: [], photo: null,
  SW: 1200, SH: 900, W: 1200, H: 900, D: 900,
  RS: 1,            // extra scale for shadow blur during scaled exports
  snapLen: 0,       // >0 while exporting: speeds snap to whole cycles per loop
  tNow: 0, t0: performance.now(),
  recording: false, rec: null, exporting: false,
};

/** Which cached layers need rebuilding before the next frame. */
export const dirty = { bg: true, cut: true, subj: true };
/** Per-active-photo caches, all SW×SH. */
export const caches = { bg: mk(1200, 900), cut: mk(1200, 900), subj: mk(1200, 900) };

export const curG = () => S.groups[S.sel];
export const crop = () => G.photo ? G.photo.crop : { x: 0, y: 0, w: G.SW, h: G.SH };

/** Re-derive SW/SH/W/H/D from the active photo. */
export function syncGeometry() {
  const p = G.photo;
  if (p) { G.SW = p.img.width; G.SH = p.img.height; G.W = p.crop.w; G.H = p.crop.h; }
  else { G.SW = G.W = 1200; G.SH = G.H = 900; }
  G.D = Math.min(G.W, G.H);
}
export function resizeCaches() {
  for (const k of ['bg', 'cut', 'subj']) if (caches[k].width !== G.SW || caches[k].height !== G.SH) caches[k] = mk(G.SW, G.SH);
  dirty.bg = dirty.cut = dirty.subj = true;
}

/** Instagram post sizes for the frame (width is always the export width, e.g. 1080). */
export const FRAME_ASPECTS = [
  ['4:5', '4:5 Portrait · 1080×1350'], ['3:4', '3:4 Portrait · 1080×1440'], ['1:1', '1:1 Square · 1080×1080'],
  ['9:16', '9:16 Story / Reel · 1080×1920'], ['1.91:1', '1.91:1 Landscape · 1080×566'],
];
export const aspectValue = a => {
  if (a === '1.91:1') return 1080 / 566; // Instagram's exact landscape size
  const [x, y] = a.split(':').map(Number); return x / y;
};
