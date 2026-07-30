# BodyMaps Segmentation Review

Browser-based CT and segmentation review for Project 1 of the JHU BodyMaps
developer call.

**Application:** <https://josephreggy23-coder.github.io/JHUdemo/>

The bundled `BDMAP_00000338` case loads automatically. Local NIfTI files and
DICOM folders can also be opened from the toolbar. Files are processed in the
browser and are not uploaded.

## Features

- Linked axial, coronal, sagittal, and 3D views
- NIfTI scan and mask import
- Local DICOM conversion with dcm2niix WebAssembly
- Nine CT window presets and direct window/level adjustment
- Voxel, patient-coordinate, HU, and structure readouts
- Structure visibility, solo view, search, opacity, and review flags
- Voxel count, volume, mean HU, standard deviation, and HU range
- Distance and angle measurements
- Paint and erase correction layer with undo
- NIfTI, CSV, JSON review report, and PNG export
- Locally saved review status and notes
- Offline caching after the first successful load

Statistics are calculated in a worker so the viewer remains responsive. A mask
must match the CT dimensions and affine before it is included in quantitative
analysis. Physical volume is calculated from the affine determinant rather than
from spacing values alone.

## Validation

The test suite parses the committed NIfTI files independently and checks the
reported results against reference values.

| Structure          |  Voxels |     Volume | Mean HU |
| ------------------ | ------: | ---------: | ------: |
| Aorta              |  17,600 |   29.33 mL |  142.53 |
| Gallbladder        |  10,088 |   16.81 mL |   18.46 |
| Left kidney        |  64,746 |  107.89 mL |  122.09 |
| Right kidney       |  65,365 |  108.92 mL |  128.81 |
| Liver              | 944,325 | 1573.53 mL |   62.56 |
| Pancreas           |  63,802 |  106.31 mL |  -24.50 |
| Inferior vena cava |  27,585 |   45.96 mL |  111.77 |
| Spleen             | 109,422 |  182.33 mL |   94.74 |
| Stomach            | 236,819 |  394.61 mL |  -84.71 |

All ten files use a `502 × 348 × 71` grid and the same affine. The exact method,
tolerances, and limits are documented in
[docs/VALIDATION.md](docs/VALIDATION.md).

## Local setup

Node.js 24 or later is required.

```bash
git clone https://github.com/josephreggy23-coder/JHUdemo.git
cd JHUdemo
npm ci
npm run dev
```

The development server prints the local address.

## Checks

```bash
npm test
npm run typecheck
npm run build
npm audit
```

Continuous integration runs the same checks for every pull request.

## Implementation

- [NiiVue 0.69.0](https://github.com/niivue/niivue) for NIfTI parsing and
  WebGL2 rendering
- [dcm2niix](https://github.com/rordenlab/dcm2niix) WebAssembly for local DICOM
  conversion
- TypeScript and Vite
- Web Worker for structure statistics
- Vitest for unit and real-data integration tests
- Service Worker for offline caching

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries and
calculation rules.

## Keyboard controls

| Key           | Action                           |
| ------------- | -------------------------------- |
| `F`           | Four-up view                     |
| `A`, `C`, `S` | Axial, coronal, or sagittal view |
| `V`           | 3D view                          |
| `1`–`9`       | Window preset                    |
| `R`           | Distance ruler                   |
| `Esc`         | Inspect mode                     |

## Limits

- This is a research application, not a diagnostic medical device.
- If a DICOM folder contains several series, the largest converted series is
  opened and the choice is reported.
- Corrections are exported as a separate layer. Source masks are not
  overwritten.
- A combined multilabel mask is displayed as one overlay.
- Large whole-body scans may exceed browser GPU memory.

## Data and license

The sample is from the JHU BodyMaps developer-call dataset:
<http://www.cs.jhu.edu/~zongwei/dataset/BDMAP_00000338.zip>.

Application code is MIT licensed. The CT and segmentation data remain the
property of their original authors and are not covered by the code license.
