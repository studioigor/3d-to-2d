# 3D to 2D Converter

> **[Studio Igor](https://www.youtube.com/@studioigor)**

[Русская версия](README.ru.md)

A web app for converting 3D models into 2D sprite sheets. Upload a model, pick animations and camera angles — get a ready-to-use sprite sheet for your game.

## Features

- Load 3D models (GLB, GLTF, FBX) via drag-and-drop or file picker
- 3D preview with camera rotation and angle presets (front, back, left, right, etc.)
- Animation playback with speed control
- Two camera modes: perspective and orthographic
- Lighting settings: custom light with intensity and position controls
- Batch export: select multiple animations and multiple angles at once
- Frame resolution (128 / 256 / 512 / 1024 px) and frame count settings
- Square frame overlay in preview — shows exact render boundaries
- Generation progress bar
- Result preview
- Download as PNG or ZIP (sprite sheet + individual frames)
- UI in Russian and English with auto-detection

## How to Run

The app is available online at **[studioigor.github.io/3d-to-2d](https://studioigor.github.io/3d-to-2d/)** — no installation needed.

To run locally — no build step required, just serve with any local server:

```bash
# Node.js
npx serve .

# Python
python3 -m http.server 8000
```

Then open `http://localhost:8000` (or `http://localhost:3000` for serve).

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [JSZip](https://stuk.github.io/jszip/) — ZIP archive creation
- [FileSaver.js](https://github.com/nicolo-ribaudo/FileSaver.js) — file downloads
- Vanilla JS, CSS, HTML — no frameworks or bundlers

## Structure

```
├── index.html              — main page
├── css/style.css           — styles (dark theme)
└── js/
    ├── app.js              — UI logic, event handling
    └── modules/
        ├── i18n.js         — RU/EN localization
        ├── scene.js        — Three.js scene, cameras, lighting
        ├── loader.js       — model loading & normalization
        └── capture.js      — sprite sheet generation & ZIP export
```

## License

MIT
