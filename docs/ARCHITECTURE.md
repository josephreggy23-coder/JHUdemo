# Architecture

## Design goals

The application keeps clinical files local and separates calculations from
rendering. Quantitative results are covered by reference tests.

```text
Local NIfTI files ─┐
                   ├─> NiiVue volumes ─> WebGL2 viewer
Local DICOM folder ┘          │
           │                  ├─> geometry validation
           └─> dcm2niix WASM  └─> statistics worker ─> QC interface

QC decisions + notes ─> local browser storage ─> JSON report
Correction drawing ─────────────────────────────> NIfTI export
```

## Modules

- `src/catalog.ts` defines canonical structures and clinical CT presets.
- `src/files.ts` classifies local NIfTI and DICOM inputs independently of MIME
  type.
- `src/statistics.ts` contains affine, geometry, quantitative, formatting, and
  CSV logic.
- `src/stats.worker.ts` receives one CT copy and all valid masks, then computes
  results away from the interaction thread.
- `src/review.ts` creates stable local-storage keys and versioned QC reports.
- `src/main.ts` is the NiiVue adapter and accessible DOM controller.

## Medical-image rules

1. The first NIfTI volume is the CT background.
2. Segmentation statistics are calculated only when the spatial dimensions and
   4×4 affine agree with the CT within `1e-4`.
3. Physical voxel volume is `abs(det(affine[0:3, 0:3]))`, not merely the
   product of header spacing values.
4. Mask volume counts every nonzero mask voxel.
5. Only finite CT samples contribute to intensity statistics; invalid CT values
   do not alter segmentation volume.
6. NIfTI slope and intercept are applied once to raw CT voxel values.
7. Original masks are read-only. Corrections occupy a separate drawing layer.

## Security boundaries

- No remote runtime CDN is used.
- Production dependencies are exactly pinned.
- DICOM conversion is lazy-loaded and runs in a worker/WASM module.
- A restrictive content-security policy blocks third-party connections.
- Local filenames are inserted through DOM text nodes rather than HTML.
- The application has no credential, upload, account, or telemetry surface.
