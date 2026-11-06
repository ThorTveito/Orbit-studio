// Layer defaults, the built-in preset library, and user presets saved in localStorage.

import { newSeed, toast } from './util.js';

export const DEFAULT_GROUP = {
  name: 'Stars', visible: true,
  shape: 'mixed', text: '✨', tint: true, thick: 0.26, wobble: 0.35, style: 'fill',
  color: '#111111', color2: '#ff5fa2', mixColors: false, strokeColor: '#ffffff', strokeWidth: 0.08,
  glow: 0, glowColor: '#ffffff',
  count: 12, size: 0.085, sizeVar: 0.55, rotVar: 0.5, angle: 0,
  layout: 'ring', cx: 0.5, cy: 0.5, rx: 0.47, ry: 0.42, tilt: -4, jitter: 0.45,
  hole: 0.35, spacing: 0.13, stagger: true, drift: 'diag',
  depth: 'wrap', backScale: 0.85, backFade: 0,
  motion: 'swing', swingAmt: 22, speed: 0.25, spinDir: 1,
  selfRot: 'wobble', selfRotAmt: 10, twinkle: 0.08, bob: 0, boil: true, boilFps: 5,
};
export const STILL = { motion: 'still', selfRot: 'none', twinkle: 0, bob: 0, boil: false };
export const BASE_SPARKLES = { shape: 'mixed', style: 'fill', color: '#111111', mixColors: false, glow: 0, count: 12, size: 0.085, sizeVar: 0.55, thick: 0.26, wobble: 0.35, rotVar: 0.5, layout: 'ring', cx: .5, cy: .5, rx: 0.47, ry: 0.42, tilt: -4, jitter: 0.45, depth: 'wrap', backScale: 0.85, backFade: 0, motion: 'swing', swingAmt: 22, speed: 0.25, selfRot: 'wobble', selfRotAmt: 10, twinkle: 0.08, bob: 0, boil: true, boilFps: 5 };
export const PRESET_CATS = [
  { name: '✦ Orbits', presets: [
    { name: 'Black sparkles', layers: [BASE_SPARKLES] },
    { name: 'Gold halo', layers: [{ shape: 'star4', color: '#ffd166', color2: '#fff4c9', mixColors: true, glow: 0.6, glowColor: '#ffbf1f', count: 14, size: 0.035, sizeVar: 0.5, thick: 0.22, wobble: 0.15, rotVar: 0, layout: 'ring', cx: .5, cy: .2, rx: .17, ry: .045, tilt: 0, jitter: .15, depth: 'wrap', backScale: .6, backFade: .35, motion: 'spin', speed: 0.25, spinDir: 1, selfRot: 'spin', twinkle: .3, bob: 0, boil: false }] },
    { name: 'Love orbit', layers: [{ shape: 'heart', style: 'both', color: '#ff4d8d', color2: '#ff9ec4', mixColors: true, strokeColor: '#ffffff', strokeWidth: 0.1, count: 9, size: .06, sizeVar: .4, wobble: .3, rotVar: .3, layout: 'ring', cx: .5, cy: .42, rx: .4, ry: .12, tilt: -8, jitter: .2, depth: 'wrap', backScale: .6, backFade: .2, motion: 'spin', speed: 0.25, spinDir: -1, selfRot: 'wobble', selfRotAmt: 15, twinkle: .1, bob: .3, boil: false }] },
    { name: 'Comic pop', layers: [{ shape: 'star8', style: 'both', color: '#ffe14d', color2: '#ff5f5f', mixColors: true, strokeColor: '#111111', strokeWidth: 0.12, count: 8, size: .08, sizeVar: .5, thick: .5, wobble: .4, rotVar: .8, layout: 'ring', rx: .44, ry: .36, tilt: 0, jitter: .4, depth: 'wrap', backScale: .8, motion: 'swing', swingAmt: 18, speed: 0.5, selfRot: 'wobble', selfRotAmt: 20, twinkle: .15, boil: true, boilFps: 6 }] },
    { name: 'Saturn ring', layers: [{ shape: 'dot', color: '#ffffff', color2: '#bfe3ff', mixColors: true, wobble: 0, count: 30, size: .016, sizeVar: .5, rotVar: 0, layout: 'ring', cx: .5, cy: .55, rx: .48, ry: .08, tilt: -12, jitter: .15, depth: 'wrap', backScale: .55, backFade: .45, motion: 'spin', speed: 0.25, spinDir: 1, selfRot: 'none', twinkle: .2, glow: .6, glowColor: '#9fd3ff', boil: false }] },
  ] },
  { name: '▦ Patterns', presets: [
    { name: 'Star wallpaper', layers: [{ shape: 'classic', color: '#111111', wobble: .04, thick: .15, layout: 'grid', spacing: .13, stagger: true, jitter: .12, size: .045, sizeVar: .12, rotVar: .25, depth: 'behind', ...STILL }] },
    { name: 'Polka dots', layers: [{ shape: 'dot', color: '#ff1a1a', wobble: 0, layout: 'grid', spacing: .17, stagger: true, jitter: 0, size: .05, sizeVar: 0, rotVar: 0, depth: 'behind', ...STILL }] },
    { name: 'Drifting stars', layers: [{ shape: 'classic', color: '#ffffff', wobble: .05, thick: .15, layout: 'grid', spacing: .12, stagger: true, jitter: .15, size: .03, sizeVar: .2, rotVar: .3, depth: 'behind', motion: 'spin', drift: 'diag', speed: 0.25, selfRot: 'none', twinkle: .1, bob: 0, boil: false }] },
    { name: 'Heart wallpaper', layers: [{ shape: 'heart', color: '#ff4d8d', color2: '#ffb3d1', mixColors: true, wobble: .2, layout: 'grid', spacing: .12, stagger: true, size: .035, sizeVar: .2, rotVar: .35, jitter: .2, depth: 'behind', motion: 'swing', swingAmt: 30, speed: 0.25, selfRot: 'wobble', selfRotAmt: 12, twinkle: 0, bob: 0, boil: true, boilFps: 4 }] },
    { name: 'Sparkle field', layers: [{ shape: 'star4', color: '#ffffff', color2: '#ffe9a8', mixColors: true, thick: .18, wobble: .15, glow: .6, glowColor: '#ffffff', layout: 'grid', spacing: .09, jitter: .9, size: .02, sizeVar: .9, rotVar: .2, depth: 'wrap', backScale: 1, motion: 'still', selfRot: 'none', twinkle: .5, bob: 0, boil: false }] },
  ] },
  { name: '☁ Clouds', presets: [
    { name: 'Pink star pop', layers: [{ shape: 'classic', color: '#ff1fb4', wobble: .05, thick: .18, layout: 'cloud', cx: .5, cy: .5, rx: .55, ry: .48, tilt: 0, hole: .3, jitter: 0, count: 22, size: .07, sizeVar: 1, rotVar: .5, depth: 'wrap', backScale: 1, backFade: 0, motion: 'swing', swingAmt: 6, speed: 0.25, selfRot: 'wobble', selfRotAmt: 6, twinkle: .04, bob: 0, boil: false }] },
    { name: 'Confetti', layers: [
      { shape: 'dot', color: '#ffd23f', color2: '#3fa7ff', mixColors: true, wobble: .3, layout: 'cloud', count: 30, size: .014, sizeVar: .6, rx: .6, ry: .55, tilt: 0, hole: .2, depth: 'wrap', backScale: .8, motion: 'spin', speed: 0.25, spinDir: 1, selfRot: 'none', twinkle: 0, bob: .6, boil: false },
      { shape: 'star4', color: '#ff4fa3', color2: '#3ddc97', mixColors: true, thick: .3, wobble: .2, layout: 'cloud', count: 22, size: .02, sizeVar: .6, rx: .6, ry: .55, tilt: 0, hole: .2, depth: 'wrap', backScale: .8, motion: 'spin', speed: 0.25, spinDir: -1, selfRot: 'spin', twinkle: .1, bob: .4, boil: false }] },
    { name: 'Bubbles', layers: [{ shape: 'dot', style: 'outline', color: '#ffffff', strokeWidth: .07, wobble: .12, glow: .25, glowColor: '#bfe6ff', layout: 'cloud', count: 18, size: .04, sizeVar: .9, rx: .55, ry: .5, tilt: 0, hole: .25, depth: 'wrap', backScale: .8, motion: 'swing', swingAmt: 10, selfRot: 'none', twinkle: .06, bob: .9, boil: false }] },
    { name: 'Moon & stars', layers: [
      { shape: 'moon', color: '#ffd84d', wobble: .2, layout: 'cloud', count: 4, size: .06, sizeVar: .4, rx: .55, ry: .5, tilt: 0, hole: .4, depth: 'wrap', backScale: .9, motion: 'swing', swingAmt: 8, selfRot: 'wobble', selfRotAmt: 10, twinkle: 0, boil: true, boilFps: 4 },
      { shape: 'star5', color: '#fff3b0', thick: .3, wobble: .3, layout: 'cloud', count: 16, size: .03, sizeVar: .7, rx: .6, ry: .55, tilt: 0, hole: .3, depth: 'wrap', backScale: .9, motion: 'swing', swingAmt: 8, twinkle: .25, selfRot: 'none', boil: true, boilFps: 4 }] },
    { name: 'Fireflies', layers: [{ shape: 'dot', color: '#eaff7a', wobble: .1, glow: 1.3, glowColor: '#c8ff3d', layout: 'cloud', count: 24, size: .009, sizeVar: .6, rx: .65, ry: .55, tilt: 0, hole: .2, depth: 'wrap', backScale: .7, backFade: .4, motion: 'swing', swingAmt: 25, selfRot: 'none', twinkle: .5, bob: 1, boil: false }] },
  ] },
  { name: '💥 Big shapes', presets: [
    { name: 'Painted starburst', layers: [
      { shape: 'star4', color: '#111111', style: 'painted', thick: .1, wobble: .5, layout: 'spot', cx: .5, cy: .42, size: .45, angle: 14, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'swing', swingAmt: 3, speed: 0.25, selfRot: 'none', twinkle: .015, bob: 0, boil: true, boilFps: 4 },
      { shape: 'star8', color: '#e8141b', style: 'painted', thick: .3, wobble: .45, layout: 'spot', cx: .5, cy: .42, size: .36, angle: -6, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'swing', swingAmt: 3, spinDir: -1, speed: 0.25, selfRot: 'none', twinkle: .02, bob: 0, boil: true, boilFps: 4 }] },
    { name: 'Sunburst', layers: [
      { shape: 'star8', color: '#ff8a00', thick: .45, wobble: .1, layout: 'spot', cx: .5, cy: .33, size: .42, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'spin', speed: 0.25, spinDir: 1, selfRot: 'none', glow: .3, glowColor: '#ffb347', twinkle: 0, bob: 0, boil: false },
      { shape: 'star8', color: '#ffd23f', thick: .5, wobble: .1, layout: 'spot', cx: .5, cy: .33, size: .32, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'spin', speed: 0.25, spinDir: -1, selfRot: 'none', twinkle: 0, bob: 0, boil: false }] },
    { name: 'Lime blob', layers: [{ shape: 'blob', color: '#c6ff3d', wobble: .6, layout: 'spot', cx: .5, cy: .45, size: .42, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'still', selfRot: 'wobble', selfRotAmt: 3, twinkle: .02, bob: 0, boil: true, boilFps: 3 }] },
    { name: 'Scribble aura', layers: [{ shape: 'scribble', color: '#2b6bff', style: 'sketch', strokeWidth: .035, wobble: .6, layout: 'spot', cx: .5, cy: .45, size: .45, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', ...STILL, boil: true, boilFps: 6 }] },
    { name: 'Heartbeat', layers: [{ shape: 'heart', color: '#ff2d55', style: 'both', strokeColor: '#ffffff', strokeWidth: .05, wobble: .25, layout: 'spot', cx: .5, cy: .42, size: .42, count: 1, sizeVar: 0, rotVar: 0, depth: 'behind', motion: 'still', selfRot: 'none', twinkle: .06, bob: 0, boil: true, boilFps: 3 }] },
  ] },
  { name: '✍️ Doodles', presets: [
    { name: 'Latte doodles', layers: [
      { shape: 'spiral', color: '#4f86e8', strokeWidth: .1, wobble: .35, layout: 'spot', cx: .55, cy: .72, size: .13, count: 1, sizeVar: 0, rotVar: 0, depth: 'front', motion: 'still', selfRot: 'wobble', selfRotAmt: 4, twinkle: 0, bob: 0, boil: true, boilFps: 5 },
      { shape: 'asterisk', color: '#7fd3e6', strokeWidth: .14, wobble: .35, layout: 'spot', cx: .5, cy: .2, size: .1, count: 1, sizeVar: 0, rotVar: 0, depth: 'front', motion: 'still', selfRot: 'wobble', selfRotAmt: 4, twinkle: 0, bob: 0, boil: true, boilFps: 5 }] },
    { name: 'Chalk doodles', layers: [{ shape: 'mixed', style: 'sketch', color: '#ffffff', strokeWidth: 0.07, count: 10, size: .09, sizeVar: .4, thick: .3, wobble: .7, rotVar: .6, layout: 'ring', rx: .45, ry: .4, tilt: 8, jitter: .5, depth: 'wrap', backScale: .85, motion: 'swing', swingAmt: 30, speed: 0.25, selfRot: 'wobble', selfRotAmt: 12, twinkle: 0, bob: 0, boil: true, boilFps: 8 }] },
    { name: 'Squiggle orbit', layers: [{ shape: 'squiggle', color: '#ffffff', strokeWidth: .12, wobble: .4, layout: 'ring', count: 8, size: .06, sizeVar: .3, rotVar: 1, rx: .45, ry: .38, tilt: 0, jitter: .4, depth: 'wrap', motion: 'spin', speed: 0.25, spinDir: 1, selfRot: 'wobble', selfRotAmt: 20, twinkle: 0, bob: 0, boil: true, boilFps: 6 }] },
    { name: 'Doodle hearts', layers: [{ shape: 'heart', style: 'sketch', color: '#ff3b3b', strokeWidth: .08, wobble: .6, layout: 'ring', count: 9, size: .06, sizeVar: .5, rotVar: .5, rx: .46, ry: .4, tilt: 0, jitter: .5, depth: 'wrap', motion: 'swing', swingAmt: 20, selfRot: 'wobble', selfRotAmt: 15, boil: true, boilFps: 8, twinkle: 0, bob: 0 }] },
    { name: 'Spiral cloud', layers: [{ shape: 'spiral', color: '#ffe14d', color2: '#ff5fa2', mixColors: true, strokeWidth: .09, wobble: .4, layout: 'cloud', count: 12, size: .045, sizeVar: .6, rotVar: 1, rx: .55, ry: .5, tilt: 0, hole: .35, depth: 'wrap', motion: 'swing', swingAmt: 10, selfRot: 'spin', twinkle: 0, bob: 0, boil: true, boilFps: 5 }] },
    { name: 'Asterisk rain', layers: [{ shape: 'asterisk', color: '#ffffff', strokeWidth: .12, wobble: .4, layout: 'grid', spacing: .15, stagger: true, jitter: .6, size: .03, sizeVar: .5, rotVar: 1, depth: 'behind', motion: 'spin', drift: 'down', speed: 0.25, selfRot: 'spin', twinkle: 0, bob: 0, boil: true, boilFps: 5 }] },
  ] },
  { name: '🌌 Atmosphere', presets: [
    { name: 'Cosmic dust', layers: [{ shape: 'star4', color: '#ffffff', color2: '#c4b5ff', mixColors: true, glow: .8, glowColor: '#a78bfa', count: 40, size: .022, sizeVar: .8, thick: .2, wobble: .1, rotVar: .3, layout: 'scatter', depth: 'wrap', backScale: .7, backFade: .2, motion: 'swing', swingAmt: 20, speed: 0.25, selfRot: 'none', twinkle: .5, bob: .5, boil: false }] },
    { name: 'Snow', layers: [{ shape: 'dot', color: '#ffffff', wobble: .2, glow: .3, glowColor: '#ffffff', layout: 'grid', spacing: .1, stagger: true, jitter: 1, size: .012, sizeVar: .8, rotVar: 0, depth: 'wrap', backScale: .7, backFade: .3, motion: 'spin', drift: 'down', speed: 0.25, selfRot: 'none', twinkle: 0, bob: .5, boil: false }] },
    { name: 'Glitter', layers: [{ shape: 'star4', color: '#ffd700', color2: '#fff6c2', mixColors: true, thick: .15, wobble: .1, glow: .7, glowColor: '#ffcc33', layout: 'scatter', count: 50, size: .018, sizeVar: .9, rotVar: .2, depth: 'wrap', backScale: .8, ...STILL, twinkle: .6 }] },
  ] },
];

let gid = 1;
/** Create a layer ("group") from defaults + overrides. */
export function newGroup(over = {}) {
  return {
    ...DEFAULT_GROUP, ...over, id: gid++, seed: newSeed(),
    customImg: over.customImg || null,           // uploaded PNG or variant 0 of a drawing
    customVariants: over.customVariants || null, // 3 hand-drawn variants of a drawing (true "boil")
    strokes: over.strokes || null,               // the drawing's strokes, so it can be edited again
    _tints: new Map(),
  };
}

// ── user presets (localStorage)
const USER_KEY = 'orbit-studio.presets.v1';
export function loadUserPresets() {
  try { const v = JSON.parse(localStorage.getItem(USER_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function storeUserPresets(list) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(list)); return true; }
  catch { toast('Couldn\'t save. Browser storage is blocked or full.', 4000); return false; }
}
/** Plain-JSON copy of a layer (drawings are stored as strokes, uploads as a data URL). */
export function serializeLayer(g) {
  const o = { seed: g.seed };
  for (const k of Object.keys(DEFAULT_GROUP)) o[k] = g[k];
  if (g.strokes) o.strokes = g.strokes;
  else if (g.customImg) try { o.customImg = g.customImg.toDataURL('image/png'); } catch { }
  return o;
}
