# BodyMaps CT Viewer

A browser-based CT scan + per-voxel segmentation viewer, built as a demo for the
JHU BodyMaps **"Developer" volunteer position** (Project 1: Web-based CT viewer),
for Prof. Zongwei Zhou's program.

The [call for developers](http://www.cs.jhu.edu/~zongwei/advert/Call4Developer.pdf) asks for:

> "...a web-based application that can visualize CT scans and per-voxel annotated
> structures, similar to 3D Slicer but can be used via a browser."

This is a working demo of exactly that: it loads a real CT scan (NIfTI) and its
per-voxel organ segmentation masks, and renders axial / coronal / sagittal slices
plus an interactive 3D volume render — entirely client-side, no backend, no build
step.

## Live demo

Open `index.html` via any static file server (see "Run locally" below), or the
GitHub Pages deployment of this repo, if enabled.

## What it does

- Loads the CT volume and 9 per-organ segmentation masks (aorta, gall bladder,
  left/right kidney, liver, pancreas, postcava, spleen, stomach) as separate
  NIfTI overlays, each rendered in a distinct color.
- Multiplanar view (axial + coronal + sagittal simultaneously), or any single
  plane, or a full 3D volume render — switchable with one click.
- CT window/level (brightness/contrast) controls with soft-tissue / lung / bone
  presets, plus manual sliders.
- Per-organ visibility toggles and a global mask-opacity slider, so individual
  structures can be shown/hidden like segments in 3D Slicer.
- Live voxel coordinate + intensity (HU) readout at the crosshair.

## Data

Sample CT scan and masks are the case linked from the JHU BodyMaps call for
developers PDF (extracted from the PDF's embedded link annotations, not visible
in a plain-text scrape):

<http://www.cs.jhu.edu/~zongwei/dataset/BDMAP_00000338.zip>

Case `BDMAP_00000338`: a CT volume (`ct.nii.gz`, 502×348×71 voxels) with 9 organ
segmentation masks (individual binary NIfTI volumes under `segmentations/`).
All files are committed under `data/` so the app is fully self-contained — no
external hosting or CORS dependency.

## Tech

Rendering is done with [Niivue](https://github.com/niivue/niivue), an
open-source WebGL2 medical imaging viewer (loaded from a CDN as an ES module —
no bundler, no `node_modules`). Niivue natively understands NIfTI (`.nii`/`.nii.gz`)
and handles slice rendering, volume rendering, colormaps, and window/level.

Everything else (`index.html`, `style.css`, `app.js`) is plain HTML/CSS/JS.

## Run locally

Any static file server works, e.g.:

```bash
cd BodyMaps-CT-Viewer
python -m http.server 8000
# then open http://localhost:8000
```

(Must be served over HTTP, not opened as a `file://` URL, since the browser
blocks `fetch()` of local files under `file://`.)

## Deploy

This is static HTML/JS/data — push to GitHub Pages (Settings → Pages → Deploy
from branch → `main` / root) and it runs as-is, no build step.
