// Custom color picker popover (saturation/value square, hue bar, hex field, swatches, eyedropper).
// Replaces the native <input type=color>, whose popup could open off-screen; this one is always
// positioned inside the window.

import { h, clamp, hexRgb, rgbHsv, hsvHex } from './util.js';

export const SWATCHES = ['#111111', '#ffffff', '#9a9aa8', '#e8141b', '#ff1a1a', '#ff5fa2', '#ff1fb4', '#ff8a00', '#ffd23f', '#c6ff3d', '#3ddc97', '#7fd3e6', '#3fa7ff', '#2b6bff', '#8b7bff', '#a78bfa'];
let picker = null;

/** A swatch button that edits obj[key]. onChange() is called on every change. */
export function colorButton(obj, key, onChange = () => { }) {
  const b = h('button', 'swatch'); b.type = 'button'; b.style.background = obj[key]; b.title = obj[key];
  b.onclick = e => { e.preventDefault(); e.stopPropagation(); if (picker && picker.btn === b) closePicker(); else openPicker(b, obj, key, onChange); };
  return b;
}
export function closePicker() {
  if (!picker) return;
  picker.el.remove(); document.removeEventListener('pointerdown', picker.onDoc, true); window.removeEventListener('keydown', picker.onKey, true);
  window.removeEventListener('resize', picker.place); picker = null;
}
function openPicker(btn, obj, key, onChange) {
  closePicker();
  const el = h('div', 'picker');
  el.innerHTML = '<div class="sv"><div class="svk"></div></div><div class="hue"><div class="huek"></div></div><div class="prow"><span class="pv"></span><input type="text" class="phex" maxlength="7" spellcheck="false" aria-label="Hex color"></div><div class="psw"></div>';
  (btn.closest('dialog') || document.body).append(el); // inside a modal dialog it must live in the dialog
  let [hh, sat, val] = rgbHsv(...hexRgb(obj[key]));
  const sv = el.querySelector('.sv'), svk = el.querySelector('.svk'), hue = el.querySelector('.hue'), huek = el.querySelector('.huek'), pv = el.querySelector('.pv'), hex = el.querySelector('.phex');
  const paint = fromHex => {
    const c = hsvHex(hh, sat, val);
    sv.style.backgroundColor = `hsl(${hh},100%,50%)`; svk.style.left = sat * 100 + '%'; svk.style.top = (1 - val) * 100 + '%'; huek.style.left = hh / 360 * 100 + '%';
    pv.style.background = c; if (!fromHex) hex.value = c;
    return c;
  };
  const commit = c => { obj[key] = c; btn.style.background = c; btn.title = c; onChange(c); };
  const drag = (area, fn) => area.addEventListener('pointerdown', e => {
    area.setPointerCapture(e.pointerId);
    const move = ev => { const r = area.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); commit(paint()); };
    move(e); area.onpointermove = move; area.onpointerup = () => { area.onpointermove = null; };
  });
  drag(sv, (x, y) => { sat = x; val = 1 - y; });
  drag(hue, x => { hh = Math.min(359.9, x * 360); });
  hex.oninput = () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { [hh, sat, val] = rgbHsv(...hexRgb(v)); paint(true); commit(v.toLowerCase()); } };
  const sw = el.querySelector('.psw');
  for (const c of SWATCHES) { const b = h('button'); b.type = 'button'; b.style.background = c; b.title = c; b.onclick = () => { [hh, sat, val] = rgbHsv(...hexRgb(c)); paint(); commit(c); }; sw.append(b); }
  if (window.EyeDropper) {
    const b = h('button', 'pick', '⊙'); b.type = 'button'; b.title = 'Pick a color from the screen';
    b.onclick = async () => { try { const r = await new EyeDropper().open(); [hh, sat, val] = rgbHsv(...hexRgb(r.sRGBHex)); paint(); commit(r.sRGBHex); } catch { } };
    sw.append(b);
  }
  paint();
  const place = () => {
    const r = btn.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight, m = 8;
    const left = clamp(r.right - pw, m, innerWidth - pw - m); let top = r.bottom + 6;
    if (top + ph > innerHeight - m) top = r.top - ph - 6;
    el.style.left = left + 'px'; el.style.top = clamp(top, m, Math.max(m, innerHeight - ph - m)) + 'px';
  };
  place();
  const onDoc = e => { if (!el.contains(e.target) && e.target !== btn) closePicker(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePicker(); } };
  document.addEventListener('pointerdown', onDoc, true); window.addEventListener('keydown', onKey, true); window.addEventListener('resize', place);
  picker = { el, btn, onDoc, onKey, place };
}
document.addEventListener('scroll', e => { if (picker && !picker.el.contains(e.target)) closePicker(); }, true);
