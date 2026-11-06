# ✦ Orbit Studio

**Hand-drawn stars, doodles and shapes that move *behind* (and in front of) you in your photos.**

Orbit Studio is a browser-based photo animation editor. Drop in one photo or a whole carousel and it cuts you out of the background with an on-device AI model. You can then surround yourself with animated objects: a ring of sparkles that swings back and forth behind you, a star wallpaper, a cloud of pink stars, or one big painted starburst. Export the result as a looping video, a GIF or a PNG, padded with a border to an exact Instagram size if you want.

Everything runs locally in your browser. **Your photos are never uploaded anywhere.**

---

## Features

### ✂️ Magic cutout
- One-click background removal powered by [`@imgly/background-removal`](https://github.com/imgly/background-removal-js), running fully on-device.
- **Erase** and **Restore** brushes to touch up the edges, with undo.
- Adjustable edge softness.
- Because of the cutout, objects can pass **behind** the subject.

### ✦ Objects & layers
- Stack as many **layers** as you like. Each layer has its own shape, style, layout and motion.
- **Shapes:** 4/5/6-point sparkles, starburst, classic star, heart, dot, blob, moon, lightning, flower and cross. Doodle line shapes: spiral, squiggle, asterisk and scribble. Any emoji or text also works.
- **✍️ Draw your own** objects with real brushes:
  - **Pen:** smooth, even line.
  - **Ink brush:** thick when you draw slowly, thin when fast, with tapered ends. Uses pen-tablet pressure.
  - **Marker:** wide, slightly see-through felt tip.
  - **Pencil:** grainy graphite.
  - **Crayon:** waxy and textured.
  - **Spray** and **Eraser**.

  Closed shapes can be filled automatically. Each drawing is redrawn into three slightly different hand-drawn versions that flicker between each other ("boil"), like real hand-drawn animation. Drawings stay editable (**✏️ Edit drawing**). A single-color drawing follows the layer color, and a multi-color one keeps its colors. You can also upload a PNG.
- **Styles:** filled, painted (brushy edges), outline, sketchy lines, or filled with a border. Optional glow, a second color mixed in, and a hand-drawn "wobble" on the edges.

### ◯ Layouts
| Layout | What it does |
|---|---|
| **Ring** | Objects on an ellipse around the subject. The top half passes behind, the bottom half in front. |
| **Cloud** | Objects bunched around the subject with an adjustable empty middle. |
| **Pattern / wallpaper** | An evenly spaced (optionally offset) grid behind you, like polka dots or star wallpaper. |
| **Scatter** | Objects anywhere in the frame. |
| **One big shape** | A single large shape, such as a painted starburst behind you. |

### 🎞 Motion (every animation loops seamlessly)
- Swing back and forth, orbit/spin, sway, or **drift** a pattern in any direction (snow, rising, diagonal).
- **Speed is set per layer in real time** (one cycle every *n* seconds), so it doesn't depend on the loop length. On export, speeds are nudged very slightly so the clip loops without a seam.
- Each object can also wiggle, spin, twinkle, float, and **boil** (the jittery hand-animated look).

### 🎨 Presets
29 presets in 6 categories, each with a preview thumbnail: **Orbits, Patterns, Clouds, Big shapes, Doodles, Atmosphere**. A preset can replace your layers or be added on top. Or hit 🎲 **Surprise me**.

**💾 Save your own presets.** This saves all your layers, including your own drawings, plus the background and subject look. Saved presets appear under **★ Mine** and are stored in your browser's `localStorage`, so they stay on that device and browser.

### 📸 Instagram frame
- Pads your photo with a border of **any color** to an exact Instagram size, so nothing gets cropped or squashed: **4:5** (1080×1350), **3:4** (1080×1440), **1:1** (1080×1080), **9:16** (1080×1920) or **1.91:1** (1080×566).
- Adjustable border thickness, optional rounded photo corners, and an export width of 1080, 1440 or 2160 px.
- **Animations are clipped to the photo.** Objects never spill onto the border, in the editor or in any export.
- Toggle it with the **▢ Frame** button or the `F` key.

### 🗂 Multiple photos (carousels)
- Open several photos at once by choosing several files, drag-and-dropping, or pasting. They appear in a **film strip** below the editor.
- Each photo has its own cutout, crop and undo. **Layers, look and frame are shared**, so a whole carousel gets one consistent style.
- New photos are cut out one after another in the background, and progress shows in the status bar.
- **⬇ Export all photos** saves a single `.zip` of PNGs, videos or GIFs, all at the same Instagram size.

### 🖼 Look
- **Background:** original, blurred, black & white, darkened, solid color, gradient, or transparent.
- **Subject:** pop / B&W / warm / cool looks, a smooth sticker outline, drop shadow and glow.
- A built-in color picker with a color square, hue bar, hex field and swatches. It always stays inside the window. In Chromium you can also pick a color straight from the screen with the ⊙ eyedropper.

### 🧰 Photoshop-style workspace
- Tool bar with **Move (V)**, **Hand (H)**, **Zoom (Z)**, **Crop (C)**, **Erase (E)** and **Restore (R)**.
- An options bar for the current tool, and a status bar with zoom controls.
- Scroll to pan. Ctrl/⌘ + scroll or a pinch zooms. Hold **Space** to pan with any tool.
- Non-destructive **crop** with aspect presets: Free, Original, 1:1, 4:5, 3:4, **9:16 (Story/Reel)**, 16:9, 3:2 and 2:3.

### 📤 Export
- **Loop length:** 1–12 s, set in the Export tab.
- **Video:** MP4 where the browser supports it, otherwise WebM. Recorded at the export size, 1–5 loops. Keep the tab visible while recording.
- **GIF:** 320–1080 px wide, 12–25 fps.
- **PNG:** a still of the current frame. It can have a transparent background.

---

## Getting started

Orbit Studio is a static site (`index.html` + `css/` + `js/` ES modules) with no build step, so it runs as-is on GitHub Pages. It loads its libraries from a CDN, so it has to be **served over HTTP** rather than opened as a `file://` URL.

```bash
git clone https://github.com/ThorTveito/Orbit-studio.git
cd Orbit-studio
python3 -m http.server 8642
```

Then open **http://localhost:8642** in Chrome, Edge or another Chromium browser. It's been tested in Chromium. Firefox and Safari should work, but video export support varies.

Any static file server works, for example `npx serve .`.

> **First cutout:** the background-removal model downloads once on first use. After that the browser caches it, so later cutouts are much faster.

---

## How to use

1. **Open photos**: drag and drop one or many, click **Open photos**, or paste with Ctrl/⌘ + V.
2. **Magic cutout** runs automatically. Fix any edges with the Erase and Restore brushes (Cutout tab).
3. **Pick a preset** (Objects tab), or build your own layers.
4. **Move tool:** drag a layer around on the photo. On rings and clouds, the white dots resize and tilt it.
5. Tweak the **Look** and turn on the **Instagram frame** (Export tab or `F`).
6. **Export** a PNG, GIF or video, or **Export all photos** as a zip.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `V` / `M` | Move tool |
| `H` | Hand (pan) |
| `Space` (hold) | Pan with any tool |
| `Z` | Zoom tool (Alt-click zooms out) |
| `C` | Crop tool. `Enter` applies, `Esc` cancels. |
| `E` / `R` | Erase / Restore brush |
| `[` / `]` | Smaller / bigger brush |
| `Ctrl/⌘ +` / `Ctrl/⌘ −` | Zoom in / out |
| `Ctrl/⌘ 0` / `Ctrl/⌘ 1` | Fit on screen / 100% |
| `Ctrl/⌘ Z` | Undo cutout edit |
| `P` | Play / pause |
| `F` | Instagram frame on / off |
| `←` / `→` | Previous / next photo |

---

## How it works

Each frame is composited on a `<canvas>` in four passes:

1. **Background:** the photo, or the chosen background effect.
2. **Back objects:** objects on the far side of the ring, objects set to "behind", etc.
3. **Subject:** the cut-out person or object, with any outline, shadow or glow.
4. **Front objects.**

When the Instagram frame is on, those passes are drawn into a clipped rectangle inside the border, so nothing can overflow onto it.

Shapes are generated as `Path2D`s from a seeded random generator. That gives every object its own hand-drawn wobble while staying the same from frame to frame. "Boil" switches between three slightly different versions of each shape. Drawings are stored as strokes and re-rendered with jittered lines for the same effect. Motion runs in real time. On export, speeds snap to whole cycles per loop so videos and GIFs loop without a visible seam.

### Tech
- Plain HTML, CSS and JavaScript (ES modules), with no framework and no build step.
- [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) for the cutout (ONNX model, runs in the browser).
- [`gifenc`](https://github.com/mattdesl/gifenc) for GIF encoding, [`fflate`](https://github.com/101arrowz/fflate) for zipping batch exports.
- `MediaRecorder` + `canvas.captureStream()` for video.

### Project layout
```
index.html          Markup only
css/app.css         Styles
js/
  main.js           Entry point: wiring, keyboard shortcuts, animation loop
  state.js          Shared state (S = design settings, G = runtime / active photo)
  util.js           DOM, math, color and file helpers
  presets.js        Layer defaults, built-in presets, saved presets (localStorage)
  shapes.js         Procedural hand-drawn shapes
  elements.js       Layers → animated elements, drawing one element
  render.js         Compositing, cutout/outline caches, Instagram frame, export sizing
  viewport.js       Zoom, pan and canvas sizing
  tools.js          Move, Hand, Zoom, Crop and cutout brushes, plus the options bar
  photos.js         Multiple photos and the film strip
  cutout.js         Background-removal queue and mask undo
  panels.js         Side-panel UI built from small schemas
  colorpicker.js    Custom color popover
  draw.js           Draw-your-own pad and brushes
  export.js         PNG, GIF, video and zip export
.claude/launch.json Dev-server config for Claude Code's preview
```

---

## Roadmap ideas
- "Cut out an object" mode (tables, cups and other non-people) for objects that peek through gaps.
- Save and load whole projects (photos + layers).
- Drag individual objects.
- Draw directly on the photo.
- More presets and shapes.

## License

[MIT](LICENSE) © 2026 Thor Tveito
