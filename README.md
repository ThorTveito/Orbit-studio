# ✦ Orbit Studio

**Hand-drawn stars, doodles and shapes that move *behind* (and in front of) you in your photos.**

Orbit Studio is a browser-based photo animation editor. Drop in a photo and it cuts you out of the background with an on-device AI model. You can then surround yourself with animated objects: a ring of sparkles that swings back and forth behind you, a star wallpaper, a cloud of pink stars, or one big painted starburst. Export the result as a looping video, a GIF or a PNG.

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
- **✍️ Draw your own:** sketch an object on the built-in pad, or upload a PNG. It's recolored automatically.
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

### 🖼 Look
- **Background:** original, blurred, black & white, darkened, solid color, gradient, or transparent.
- **Subject:** pop / B&W / warm / cool looks, a smooth sticker outline, drop shadow and glow.
- A built-in color picker with a color square, hue bar, hex field and swatches. It always stays inside the window. In Chromium you can also pick a color straight from the screen with the ⊙ eyedropper.

### 🧰 Photoshop-style workspace
- Tool bar with **Move (V)**, **Hand (H)**, **Zoom (Z)**, **Crop (C)**, **Erase (E)** and **Restore (R)**.
- An options bar for the current tool, and a status bar with zoom controls.
- Scroll to pan. Ctrl/⌘ + scroll or a pinch zooms. Hold **Space** to pan with any tool.
- Non-destructive **crop** with aspect presets: Free, Original, 1:1, 4:5, **9:16 (Story/Reel)**, 16:9, 3:2 and 2:3.

### 📤 Export
- **Loop length:** 1–12 s, set in the Export tab.
- **Video:** MP4 where the browser supports it, otherwise WebM. Recorded at full resolution, 1–5 loops.
- **GIF:** 320–800 px wide, 12–25 fps.
- **PNG:** a still of the current frame. It can have a transparent background.

---

## Getting started

Orbit Studio is a single static page (`index.html`) with no build step. It loads its libraries from a CDN, so it has to be **served over HTTP** rather than opened as a `file://` URL.

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

1. **Open a photo**: drag and drop it, click **Open photo**, or paste with Ctrl/⌘ + V.
2. **Magic cutout** runs automatically. Fix any edges with the Erase and Restore brushes (Cutout tab).
3. **Pick a preset** (Objects tab), or build your own layers.
4. **Move tool:** drag a layer around on the photo. On rings and clouds, the white dots resize and tilt it.
5. Tweak the **Look**, then go to **Export** and save a video, GIF or PNG.

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

---

## How it works

Each frame is composited on a `<canvas>` in four passes:

1. **Background:** the photo, or the chosen background effect.
2. **Back objects:** objects on the far side of the ring, objects set to "behind", etc.
3. **Subject:** the cut-out person or object, with any outline, shadow or glow.
4. **Front objects.**

Shapes are generated as `Path2D`s from a seeded random generator. That gives every object its own hand-drawn wobble while staying the same from frame to frame. "Boil" switches between three slightly different versions of each shape. All motion is tied to the loop length, so exported videos and GIFs loop without a visible seam.

### Tech
- Plain HTML, CSS and JavaScript (ES modules), with no framework and no build step.
- [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) for the cutout (ONNX model, runs in the browser).
- [`gifenc`](https://github.com/mattdesl/gifenc) for GIF encoding.
- `MediaRecorder` + `canvas.captureStream()` for video.

### Project layout
```
index.html           The whole app (markup, styles and code)
.claude/launch.json  Dev-server config for Claude Code's preview
```

---

## Roadmap ideas
- "Cut out an object" mode (tables, cups and other non-people) for objects that peek through gaps.
- Save and load projects.
- Drag individual objects.
- More presets and shapes.

## License

[MIT](LICENSE) © 2026 Thor Tveito
