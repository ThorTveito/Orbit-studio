// Side-panel UI: layer controls, layer list, preset gallery (built-in + saved), Look, Cutout,
// Instagram frame and Export settings. Everything is generated from small schemas.

import { $, h, mk, TAU, rng, clamp, lerp, toast, hsl, luminance, newSeed, urlToCanvas } from './util.js';
import { S, dirty, curG, FRAME_ASPECTS } from './state.js';
import { DEFAULT_GROUP, BASE_SPARKLES, PRESET_CATS, newGroup, loadUserPresets, storeUserPresets, serializeLayer } from './presets.js';
import { SPARKLES, OPEN } from './shapes.js';
import { drawEl } from './elements.js';
import { colorButton } from './colorpicker.js';
import { refreshCanvas } from './viewport.js';
import { syncBrushUI } from './tools.js';
import { openDraw, setDrawing } from './draw.js';

const isSparkle = g => ['mixed', 'star4', 'star5', 'star6', 'star8', 'classic'].includes(g.shape);
const isRing = g => g.layout === 'ring' || g.layout === 'cloud';
const notCustom = g => g.shape !== 'custom';
const MOTIONS = {
  grid: [['still', 'Still'], ['swing', 'Sway side to side'], ['spin', 'Drift (scrolling)']],
  spot: [['still', 'Still'], ['swing', 'Rock back and forth'], ['spin', 'Spin']],
  other: [['swing', 'Swing back and forth'], ['spin', 'Orbit (spin around)'], ['still', 'Still']],
};
const deg = v => v + '°', pct = v => Math.round(v * 100) + '%';
export const groupSchema = [
  { sec: 'Object' },
  { k: 'shape', l: 'Shape', t: 'select', o: [['mixed', '✦ Mixed sparkles'], ['star4', '4-point sparkle'], ['star5', '5-point sparkle'], ['star6', '6-point sparkle'], ['star8', 'Starburst'], ['classic', 'Classic star ★'], ['heart', 'Heart'], ['dot', 'Dot / bubble'], ['blob', 'Blob'], ['moon', 'Moon'], ['bolt', 'Lightning'], ['flower', 'Flower'], ['cross', 'Cross / plus'], ['spiral', 'Spiral (doodle)'], ['squiggle', 'Squiggle (doodle)'], ['asterisk', 'Asterisk (doodle)'], ['scribble', 'Scribble (doodle)'], ['text', 'Emoji / text'], ['custom', '✍️ My drawing / image']] },
  { t: 'buttons', show: g => g.shape === 'custom', b: [['✍️ Draw your own', () => openDraw(), 'primary'], ['Upload PNG', () => $('#customFile').click()]] },
  { t: 'buttons', show: g => g.shape === 'custom' && !!g.strokes, b: [['✏️ Edit drawing', () => openDraw(curG())]] },
  { k: 'tint', l: 'Recolor my drawing/image', t: 'check', show: g => g.shape === 'custom' },
  { k: 'text', l: 'Emoji or text', t: 'text', show: g => g.shape === 'text' },
  { k: 'thick', l: 'Chubbiness', t: 'range', min: 0.05, max: 0.6, step: 0.01, show: isSparkle, fmt: pct },
  { k: 'wobble', l: 'Hand-drawn wobble', t: 'range', min: 0, max: 1, step: 0.01, show: g => !['text', 'custom'].includes(g.shape), fmt: pct },
  { k: 'style', l: 'Style', t: 'select', o: [['fill', 'Filled'], ['painted', 'Painted (brushy edges)'], ['outline', 'Outline'], ['sketch', 'Sketchy lines'], ['both', 'Filled + border']], show: notCustom },
  { k: 'color', l: 'Color', t: 'color', show: g => notCustom(g) || g.tint },
  { k: 'mixColors', l: 'Mix in a second color', t: 'check', show: g => notCustom(g) || g.tint },
  { k: 'color2', l: 'Second color', t: 'color', show: g => g.mixColors && (notCustom(g) || g.tint) },
  { k: 'strokeColor', l: 'Border color', t: 'color', show: g => g.style === 'both' && notCustom(g) },
  { k: 'strokeWidth', l: 'Line thickness', t: 'range', min: 0.02, max: 0.3, step: 0.01, show: g => notCustom(g) && (OPEN.has(g.shape) || ['outline', 'sketch', 'both'].includes(g.style)) },
  { k: 'glow', l: 'Glow', t: 'range', min: 0, max: 1.5, step: 0.05 },
  { k: 'glowColor', l: 'Glow color', t: 'color', show: g => g.glow > 0 },
  { sec: 'Layout' },
  { k: 'layout', l: 'Arrangement', t: 'select', o: [['ring', '◯ Ring around subject'], ['cloud', '☁ Cloud around subject'], ['grid', '▦ Pattern / wallpaper'], ['scatter', '∴ Scattered everywhere'], ['spot', '● One big shape']] },
  { k: 'count', l: 'How many', t: 'range', min: 1, max: 80, step: 1, show: g => g.layout !== 'grid' && g.layout !== 'spot' },
  { k: 'spacing', l: 'Spacing', t: 'range', min: 0.04, max: 0.4, step: 0.005, show: g => g.layout === 'grid', fmt: pct },
  { k: 'stagger', l: 'Offset every other row', t: 'check', show: g => g.layout === 'grid' },
  { k: 'size', l: 'Size', t: 'range', min: 0.005, max: 0.6, step: 0.005, fmt: v => (v * 100).toFixed(1) },
  { k: 'sizeVar', l: 'Size variety', t: 'range', min: 0, max: 1, step: 0.01, show: g => g.layout !== 'spot', fmt: pct },
  { k: 'angle', l: 'Rotation', t: 'range', min: -180, max: 180, step: 1, fmt: deg },
  { k: 'rotVar', l: 'Random tilt', t: 'range', min: 0, max: 1, step: 0.01, show: g => g.layout !== 'spot', fmt: pct },
  { k: 'rx', l: g => g.layout === 'cloud' ? 'Cloud width' : 'Ring width', t: 'range', min: 0.02, max: 1, step: 0.005, show: isRing, fmt: pct },
  { k: 'ry', l: g => g.layout === 'cloud' ? 'Cloud height' : 'Ring height', t: 'range', min: 0.02, max: 1, step: 0.005, show: isRing, fmt: pct },
  { k: 'tilt', l: 'Tilt', t: 'range', min: -90, max: 90, step: 1, show: isRing, fmt: deg },
  { k: 'hole', l: 'Empty middle', t: 'range', min: 0, max: 0.95, step: 0.01, show: g => g.layout === 'cloud', fmt: pct },
  { k: 'cx', l: g => g.layout === 'grid' ? 'Pattern offset X' : 'Center X', t: 'range', min: 0, max: 1, step: 0.005, show: g => g.layout !== 'scatter', fmt: pct },
  { k: 'cy', l: g => g.layout === 'grid' ? 'Pattern offset Y' : 'Center Y', t: 'range', min: 0, max: 1, step: 0.005, show: g => g.layout !== 'scatter', fmt: pct },
  { k: 'jitter', l: 'Messiness', t: 'range', min: 0, max: 1, step: 0.01, show: g => g.layout === 'ring' || g.layout === 'grid', fmt: pct },
  { k: 'depth', l: 'Depth', t: 'select', o: g => g.layout === 'spot' ? [['behind', 'Behind subject'], ['front', 'In front']] : [['wrap', 'Wrap around (behind + in front)'], ['behind', 'All behind subject'], ['front', 'All in front']] },
  { k: 'backScale', l: 'Far objects smaller', t: 'range', min: 0.3, max: 1, step: 0.01, show: g => g.depth === 'wrap' && g.layout !== 'spot', fmt: pct },
  { k: 'backFade', l: 'Far objects faded', t: 'range', min: 0, max: 0.9, step: 0.01, show: g => g.depth === 'wrap' && g.layout !== 'spot', fmt: pct },
  { t: 'buttons', b: [['🎲 Reshuffle', () => { curG().seed = newSeed(); }]] },
  { sec: 'Motion' },
  { k: 'motion', l: 'Movement', t: 'select', o: g => MOTIONS[g.layout] || MOTIONS.other },
  { k: 'drift', l: 'Drift direction', t: 'select', o: [['diag', '↘ Diagonal'], ['right', '→ Right'], ['left', '← Left'], ['down', '↓ Down (falling)'], ['up', '↑ Up (rising)']], show: g => g.layout === 'grid' && g.motion === 'spin' },
  { k: 'swingAmt', l: g => g.layout === 'ring' || g.layout === 'cloud' || g.layout === 'spot' ? 'Swing amount' : 'Sway amount', t: 'range', min: 0, max: 180, step: 1, show: g => g.motion === 'swing' || (g.motion === 'spin' && g.layout === 'scatter'), fmt: deg },
  { k: 'speed', l: 'Speed', t: 'range', min: 0.05, max: 2, step: 0.05, show: g => g.motion !== 'still', fmt: v => `1 cycle / ${(1 / v).toFixed(v > 0.5 ? 2 : 1)} s` },
  { k: 'spinDir', l: 'Direction', t: 'select', num: true, o: [['1', 'Clockwise'], ['-1', 'Counter-clockwise']], show: g => (g.motion === 'spin' && g.layout !== 'grid') || (g.motion === 'swing' && g.layout === 'spot') },
  { k: 'selfRot', l: 'Each object', t: 'select', o: [['none', 'Doesn\'t rotate'], ['wobble', 'Wiggles'], ['spin', 'Spins']] },
  { k: 'selfRotAmt', l: 'Wiggle amount', t: 'range', min: 0, max: 60, step: 1, show: g => g.selfRot === 'wobble', fmt: deg },
  { k: 'twinkle', l: 'Twinkle (pulse size)', t: 'range', min: 0, max: 0.6, step: 0.01, fmt: pct },
  { k: 'bob', l: 'Float up & down', t: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
  { k: 'boil', l: 'Boil (hand-animated jitter)', t: 'check' },
  { k: 'boilFps', l: 'Boil speed', t: 'range', min: 2, max: 12, step: 1, show: g => g.boil, fmt: v => v + '/s' },
];

const lookSchema = [
  { sec: 'Background' },
  { k: 'mode', obj: () => S.bg, l: 'Background', t: 'select', o: [['original', 'Original photo'], ['blur', 'Blurred'], ['bw', 'Black & white'], ['dim', 'Darkened'], ['solid', 'Solid color'], ['gradient', 'Gradient'], ['none', 'Transparent (PNG only)']] },
  { k: 'blur', obj: () => S.bg, l: 'Blur amount', t: 'range', min: 2, max: 60, step: 1, show: b => b.mode === 'blur' },
  { k: 'dim', obj: () => S.bg, l: 'Darkness', t: 'range', min: 0.05, max: 0.9, step: 0.01, show: b => b.mode === 'dim', fmt: pct },
  { k: 'color', obj: () => S.bg, l: 'Color', t: 'color', show: b => b.mode === 'solid' || b.mode === 'gradient' },
  { k: 'color2', obj: () => S.bg, l: 'Second color', t: 'color', show: b => b.mode === 'gradient' },
  { sec: 'Subject (you)' },
  { k: 'look', obj: () => S.subject, l: 'Look', t: 'select', o: [['original', 'Original'], ['pop', 'Pop (more color)'], ['bw', 'Black & white'], ['warm', 'Warm'], ['cool', 'Cool']] },
  { k: 'outline', obj: () => S.subject, l: 'Sticker outline', t: 'range', min: 0, max: 30, step: 1 },
  { k: 'outlineColor', obj: () => S.subject, l: 'Outline color', t: 'color', show: s => s.outline > 0 },
  { k: 'shadow', obj: () => S.subject, l: 'Drop shadow', t: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
  { k: 'glow', obj: () => S.subject, l: 'Glow', t: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
  { k: 'glowColor', obj: () => S.subject, l: 'Glow color', t: 'color', show: s => s.glow > 0 },
];

export function surprise() {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
  const hue = Math.floor(R() * 360), layout = pick(['ring', 'ring', 'cloud', 'cloud', 'grid', 'scatter', 'spot']);
  const shape = pick(['mixed', 'mixed', 'star4', 'star5', 'star8', 'classic', 'classic', 'heart', 'dot', 'blob', 'moon', 'bolt', 'flower', 'cross', 'spiral', 'squiggle', 'asterisk']);
  const g = newGroup({
    shape, layout, style: pick(['fill', 'fill', 'painted', 'outline', 'sketch', 'both']),
    color: hsl(hue, 85, 58), color2: hsl((hue + 40 + R() * 140) % 360, 85, 65), mixColors: R() < .6,
    strokeColor: pick(['#ffffff', '#111111']), strokeWidth: .06 + R() * .06, glow: R() < .3 ? 0.4 + R() * 0.6 : 0, glowColor: hsl(hue, 90, 70),
    count: 6 + Math.floor(R() * 20), size: layout === 'spot' ? .3 + R() * .15 : layout === 'grid' ? .025 + R() * .03 : .035 + R() * .06,
    sizeVar: layout === 'spot' ? 0 : R() * .9, thick: .15 + R() * .3, wobble: R() * .7, spacing: .09 + R() * .1, hole: .2 + R() * .3,
    depth: layout === 'spot' || layout === 'grid' ? 'behind' : 'wrap', cy: layout === 'spot' ? .42 : .5,
    motion: pick(['swing', 'swing', 'spin', 'still']), swingAmt: layout === 'spot' ? 4 : 10 + R() * 40, drift: pick(['diag', 'down', 'right', 'up']),
    selfRot: pick(['wobble', 'spin', 'none']), twinkle: R() * .25, bob: R() * .4, boil: R() < .6,
  });
  if ($('#presetAdd').checked) { S.groups.push(g); S.sel = S.groups.length - 1; } else { S.groups = [g]; S.sel = 0; }
  refreshAll();
}

// ───────────────────────── generic field builder
const fmtNum = (f, v) => f.fmt ? f.fmt(v) : (f.step && f.step < 1 ? (+v).toFixed(f.step < 0.1 ? 2 : 1) : String(v));
/** Build form controls from a schema. onChange(field, structural) – structural = visible fields may
 *  have changed, so the caller should rebuild. Sliders only report that on release, so dragging is
 *  never interrupted by a rebuild. */
export function buildFields(container, schema, defObj, onChange) {
  container.innerHTML = '';
  const objOf = f => f.obj ? f.obj() : defObj;
  const visible = () => schema.map(f => f.sec ? '' : (!f.show || f.show(objOf(f))) ? 1 : 0).join('');
  const shown = visible();
  let sec = null;
  for (const f of schema) {
    if (f.sec) { sec = h('div', 'sec', h('h4', null, f.sec)); container.append(sec); continue; }
    const obj = objOf(f);
    if (f.show && !f.show(obj)) continue;
    const parent = sec || container;
    if (f.t === 'buttons') { const row = h('div', 'row'); f.b.forEach(([lab, fn, cls]) => { const b = h('button', 'btn small ' + (cls || ''), lab); b.onclick = fn; row.append(b); }); row.style.marginBottom = '12px'; parent.append(row); continue; }
    if (f.t === 'note') { parent.append(h('p', 'muted', typeof f.l === 'function' ? f.l(obj) : f.l)); continue; }
    const lab = h('span', null, typeof f.l === 'function' ? f.l(obj) : f.l);
    let row;
    if (f.t === 'range') {
      const inp = h('input'); inp.type = 'range'; inp.min = f.min; inp.max = f.max; inp.step = f.step ?? 1; inp.value = obj[f.k]; inp.dataset.k = f.k;
      const out = h('output', null, fmtNum(f, obj[f.k]));
      inp.oninput = () => { obj[f.k] = +inp.value; out.textContent = fmtNum(f, obj[f.k]); onChange(f, false); };
      inp.onchange = () => { if (visible() !== shown) onChange(f, true); };
      row = h('div', 'field', [h('div', 'labrow', [lab, out]), inp]);
    } else if (f.t === 'select') {
      const sel = h('select'); (typeof f.o === 'function' ? f.o(obj) : f.o).forEach(([v, l]) => { const o = h('option', null, l); o.value = v; sel.append(o); }); sel.value = String(obj[f.k]);
      sel.onchange = () => { obj[f.k] = f.num ? +sel.value : sel.value; onChange(f, true); };
      row = h('label', 'field', [h('div', 'labrow', lab), sel]);
    } else if (f.t === 'color') {
      row = h('div', 'field inline', [lab, colorButton(obj, f.k, () => onChange(f, visible() !== shown))]);
    } else if (f.t === 'check') {
      const inp = h('input'); inp.type = 'checkbox'; inp.checked = !!obj[f.k];
      inp.onchange = () => { obj[f.k] = inp.checked; onChange(f, true); };
      row = h('label', 'field inline', [lab, inp]);
    } else if (f.t === 'text') {
      const inp = h('input'); inp.type = 'text'; inp.value = obj[f.k]; inp.maxLength = 12;
      inp.oninput = () => { obj[f.k] = inp.value || '✨'; onChange(f, false); };
      row = h('label', 'field', [h('div', 'labrow', lab), inp]);
    }
    parent.append(row);
  }
}
/** Update slider values in place (used while dragging a ring on the canvas). */
export function syncFields(keys) {
  const g = curG(); if (!g) return;
  for (const k of keys) {
    const inp = document.querySelector(`#groupControls input[data-k="${k}"]`); if (!inp) continue;
    inp.value = g[k]; const f = groupSchema.find(x => x.k === k); inp.closest('.field').querySelector('output').textContent = fmtNum(f, g[k]);
  }
}

// ───────────────────────── layers
export function buildGroupPanel() {
  const g = curG(); const el = $('#groupControls');
  if (!g) { el.innerHTML = '<p class="muted" style="padding-top:14px">No layers. Add one above or pick a preset.</p>'; return; }
  buildFields(el, groupSchema, g, (f, structural) => {
    if (structural) buildGroupPanel();
    if (['color', 'color2', 'shape', 'mixColors'].includes(f.k)) buildLayers();
  });
}
const SHAPE_NAMES = Object.fromEntries(groupSchema.find(f => f.k === 'shape').o);
export function buildLayers() {
  const el = $('#layers'); el.innerHTML = '';
  S.groups.forEach((g, i) => {
    const row = h('div', 'layer' + (i === S.sel ? ' on' : ''));
    const sw = h('span', 'sw'); sw.style.background = g.mixColors ? `linear-gradient(135deg,${g.color} 50%,${g.color2} 50%)` : g.color;
    const nm = h('span', 'nm', `${i + 1}. ${SHAPE_NAMES[g.shape].replace(/^\W+\s/, '')}`);
    const eye = h('button', 'ib', g.visible ? '👁' : '—'); eye.title = 'Show/hide';
    eye.onclick = ev => { ev.stopPropagation(); g.visible = !g.visible; buildLayers(); };
    const dup = h('button', 'ib', '⧉'); dup.title = 'Duplicate';
    dup.onclick = ev => { ev.stopPropagation(); const c = newGroup({ ...g }); c.rx = g.rx * 0.8; c.ry = g.ry * 0.8; S.groups.splice(i + 1, 0, c); S.sel = i + 1; refreshAll(); };
    const del = h('button', 'ib', '✕'); del.title = 'Delete';
    del.onclick = ev => { ev.stopPropagation(); S.groups.splice(i, 1); S.sel = Math.max(0, Math.min(S.sel, S.groups.length - 1)); refreshAll(); };
    row.append(sw, nm, eye, dup, del);
    row.onclick = () => { S.sel = i; refreshAll(); };
    el.append(row);
  });
}
export function refreshAll() { buildLayers(); buildGroupPanel(); }
export function addLayer() {
  const g = newGroup({ ...BASE_SPARKLES, count: 8, rx: 0.3, ry: 0.12, cy: 0.3, size: 0.05, color: '#ffffff', glow: 0.4, glowColor: '#ffffff' });
  S.groups.push(g); S.sel = S.groups.length - 1; refreshAll();
}

// ───────────────────────── presets gallery
let presetCat = 1; // 0 = ★ Mine
const thumbCache = new Map();
function presetCats() { return [{ name: '★ Mine', user: true, presets: loadUserPresets() }, ...PRESET_CATS]; }
function presetThumb(p) {
  const tkey = p.name + '|' + (p.savedAt || '');
  if (thumbCache.has(tkey)) return thumbCache.get(tkey);
  const Z = 120, c = mk(Z, Z), x = c.getContext('2d');
  const L = p.layers.map((l, k) => ({ ...DEFAULT_GROUP, ...l, customImg: null, customVariants: null, seed: 9001 + k * 77, _tints: new Map() }));
  const light = luminance(L[0].color) < 0.62;
  x.fillStyle = light ? '#ece6da' : '#2b2b36'; x.fillRect(0, 0, Z, Z);
  const person = () => { x.fillStyle = light ? '#bdb5a8' : '#5a5a70'; x.beginPath(); x.arc(60, 46, 13, 0, TAU); x.fill(); x.beginPath(); x.ellipse(60, 104, 27, 38, 0, 0, TAU); x.fill(); };
  const back = [], front = [];
  L.forEach(g => {
    const r = rng(g.seed), base = clamp(g.size * Z, 2.5, 56);
    const add = (px, py, sz, i, isFront) => (isFront ? front : back).push({ g, i, v: 0, x: px, y: py, kind: g.shape === 'mixed' ? SPARKLES[i % 4] : (g.shape === 'custom' || g.shape === 'text' ? 'star4' : g.shape), rot: g.angle * Math.PI / 180 + (r() - .5) * g.rotVar * Math.PI, size: Math.max(1.5, sz), alpha: 1, color: g.mixColors && r() > .5 ? g.color2 : g.color });
    const frontOf = () => g.depth === 'front' || (g.depth === 'wrap' && r() < 0.45);
    const vary = () => base * (1 + (r() - .5) * g.sizeVar * 1.3);
    if (g.layout === 'grid') {
      const sp = Math.max(9, g.spacing * Z), rh = g.stagger ? sp * .866 : sp; let i = 0;
      for (let row = 0, y = sp * .4; y < Z + sp; y += rh, row++) for (let xx = (g.stagger && row % 2 ? sp / 2 : 0) + sp * .3; xx < Z + sp; xx += sp) add(xx + (r() - .5) * g.jitter * sp * .8, y + (r() - .5) * g.jitter * rh * .8, vary(), i++, frontOf());
    } else if (g.layout === 'spot') add(g.cx * Z, g.cy * Z, base, 0, g.depth === 'front');
    else if (g.layout === 'scatter') { for (let i = 0; i < Math.min(g.count, 34); i++) add(r() * Z, r() * Z, vary(), i, frontOf()); }
    else {
      const n = Math.min(g.count, g.layout === 'cloud' ? 22 : 12), tl = g.tilt * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const th = g.layout === 'cloud' ? r() * TAU : -Math.PI / 2 + i * TAU / n, rad = g.layout === 'cloud' ? lerp(g.hole, 1, Math.sqrt(r())) : 1;
        const lx = Math.cos(th) * g.rx * Z * rad, ly = Math.sin(th) * g.ry * Z * rad;
        const isF = g.depth === 'front' || (g.depth === 'wrap' && (g.layout === 'cloud' ? r() < .45 : Math.sin(th) > 0));
        add(g.cx * Z + lx * Math.cos(tl) - ly * Math.sin(tl), g.cy * Z + lx * Math.sin(tl) + ly * Math.cos(tl), vary(), i, isF);
      }
    }
  });
  back.forEach(e => drawEl(x, e)); person(); front.forEach(e => drawEl(x, e));
  thumbCache.set(tkey, c); return c;
}
export function applyPreset(p) {
  const layers = p.layers.map(l => {
    const g = newGroup({ ...l, customImg: null, strokes: null });
    if (l.seed) g.seed = l.seed; // saved presets keep their exact look
    if (l.strokes) setDrawing(g, l.strokes);
    else if (typeof l.customImg === 'string') urlToCanvas(l.customImg).then(c => { g.customImg = c; g._tints = new Map(); });
    return g;
  });
  if ($('#presetAdd').checked) { S.groups.push(...layers); S.sel = S.groups.length - layers.length; }
  else {
    S.groups = layers; S.sel = 0;
    if (p.look) { Object.assign(S.bg, p.look.bg); Object.assign(S.subject, p.look.subject); dirty.bg = dirty.cut = dirty.subj = true; buildLook(); }
  }
  refreshAll(); toast(`✦ ${p.name}${layers.length > 1 ? ` (${layers.length} layers)` : ''}`);
}
export function buildPresets() {
  const cats = $('#presetCats'); cats.innerHTML = '';
  const CATS = presetCats(); presetCat = Math.min(presetCat, CATS.length - 1);
  CATS.forEach((cat, i) => { const b = h('button', 'chip' + (i === presetCat ? ' on' : ''), cat.name); b.onclick = () => { presetCat = i; buildPresets(); }; cats.append(b); });
  const sur = h('button', 'chip', '🎲 Surprise me'); sur.onclick = surprise; cats.append(sur);
  const grid = $('#presets'); grid.innerHTML = '';
  const cat = CATS[presetCat];
  if (cat.user && !cat.presets.length) grid.append(h('p', 'muted pempty', 'No saved presets yet. Set up your layers and look, then press “💾 Save current as preset” below. Saved presets stay in this browser.'));
  for (const p of cat.presets) {
    const card = h('div', 'pcard', [presetThumb(p), h('span', null, p.name)]); card.tabIndex = 0; card.setAttribute('role', 'button');
    card.title = p.layers.length > 1 ? `${p.layers.length} layers` : '';
    card.onclick = () => applyPreset(p); card.onkeydown = e => { if (e.key === 'Enter') applyPreset(p); };
    if (cat.user) {
      const del = h('button', 'pdel', '✕'); del.type = 'button'; del.title = 'Delete preset';
      del.onclick = e => { e.stopPropagation(); if (del.classList.contains('armed')) deleteUserPreset(p.name); else { del.classList.add('armed'); del.textContent = 'Delete?'; setTimeout(() => { del.classList.remove('armed'); del.textContent = '✕'; }, 2500); } };
      card.append(del);
    }
    grid.append(card);
  }
}
export function saveCurrentAsPreset(name) {
  name = (name || '').trim(); if (!name) { toast('Give your preset a name'); return false; }
  if (!S.groups.length) { toast('Add at least one layer first'); return false; }
  const list = loadUserPresets(), i = list.findIndex(x => x.name === name);
  const preset = { name, savedAt: Date.now(), layers: S.groups.map(serializeLayer), look: { bg: { ...S.bg }, subject: { ...S.subject } } };
  if (i >= 0) list[i] = preset; else list.unshift(preset);
  if (!storeUserPresets(list)) return false;
  presetCat = 0; buildPresets(); toast(i >= 0 ? `Updated “${name}”` : `Saved “${name}” to My presets`); return true;
}
function deleteUserPreset(name) { storeUserPresets(loadUserPresets().filter(x => x.name !== name)); buildPresets(); toast(`Deleted “${name}”`); }

// ───────────────────────── Look, cutout, frame and export panes
function buildLookPane() {
  buildFields($('#lookFields'), lookSchema, S, (f, structural) => {
    if (f.obj && f.obj() === S.bg) dirty.bg = true;
    if (f.obj && f.obj() === S.subject) { if (f.k === 'look') dirty.cut = true; else dirty.subj = true; }
    if (structural) buildLookPane();
  });
}
export const buildLook = buildLookPane;
const frameSchema = [
  { k: 'on', l: 'Add a border for Instagram', t: 'check' },
  { k: 'aspect', l: 'Post size', t: 'select', o: FRAME_ASPECTS, show: f => f.on },
  { k: 'color', l: 'Border color', t: 'color', show: f => f.on },
  { k: 'pad', l: 'Border thickness', t: 'range', min: 0, max: 0.2, step: 0.005, show: f => f.on, fmt: v => Math.round(v * 100) + '%' },
  { k: 'radius', l: 'Rounded photo corners', t: 'range', min: 0, max: 1, step: 0.01, show: f => f.on, fmt: v => Math.round(v * 100) + '%' },
  { k: 'size', l: 'Export width', t: 'select', num: true, o: [['1080', '1080 px (Instagram standard)'], ['1440', '1440 px'], ['2160', '2160 px (extra sharp)']], show: f => f.on },
];
export function buildFramePane() {
  buildFields($('#frameFields'), frameSchema, S.frame, (f, structural) => {
    refreshCanvas();
    if (structural) buildFramePane();
    $('#btnFrame').classList.toggle('on', S.frame.on);
  });
}
export function buildCutoutPane() {
  buildFields($('#cutoutFields'), [
    { k: 'quality', l: 'Quality', t: 'select', o: [['isnet_fp16', 'Best (bigger one-time download)'], ['isnet_quint8', 'Fast (smaller download)']] },
    { k: 'autoCutout', l: 'Cut out new photos automatically', t: 'check' },
  ], S, () => { });
  buildFields($('#brushFields'), [
    { k: 'brush', l: 'Brush size', t: 'range', min: 4, max: 300, step: 1 },
    { k: 'feather', l: 'Edge softness', t: 'range', min: 0, max: 10, step: 0.5 },
  ], S, f => { if (f.k === 'feather') dirty.cut = true; if (f.k === 'brush') syncBrushUI(); });
}
export function buildExportPane() {
  buildFields($('#loopFields'), [{ k: 'loop', l: 'Loop length', t: 'range', min: 1, max: 12, step: 0.5, fmt: v => v + ' s' }], S, () => { });
  buildFields($('#videoFields'), [{ k: 'loops', l: 'Length', t: 'select', num: true, o: [['1', '1 loop'], ['2', '2 loops'], ['3', '3 loops'], ['5', '5 loops']] }], S.video, () => { });
  buildFields($('#gifFields'), [
    { k: 'width', l: 'Width', t: 'select', num: true, o: [['320', '320 px'], ['480', '480 px'], ['640', '640 px'], ['800', '800 px'], ['1080', '1080 px']] },
    { k: 'fps', l: 'Frames per second', t: 'select', num: true, o: [['12', '12'], ['20', '20'], ['25', '25']] },
  ], S.gif, () => { });
  buildFields($('#batchFields'), [{ k: 'format', l: 'Format', t: 'select', o: [['png', 'PNG stills'], ['video', 'Videos (real-time, takes a while)'], ['gif', 'GIFs']] }], S.batch, () => { });
}
