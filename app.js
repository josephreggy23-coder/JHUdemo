// Niivue is a self-contained WebGL2 medical imaging renderer: it understands
// NIfTI natively, needs no backend/build step, and handles slice + volume
// rendering, colormaps, and windowing out of the box. That's what makes a
// "3D Slicer in the browser" demo like this feasible as a static site.
import { Niivue } from "https://esm.sh/@niivue/niivue@0.69.0";

// ---- Organs in the sample case (BDMAP_00000338), each assigned a distinct color ----
const ORGANS = [
  { file: "aorta.nii.gz", name: "Aorta", colormap: "red" },
  { file: "gall_bladder.nii.gz", name: "Gall bladder", colormap: "green" },
  { file: "kidney_left.nii.gz", name: "Kidney (L)", colormap: "blue" },
  { file: "kidney_right.nii.gz", name: "Kidney (R)", colormap: "winter" },
  { file: "liver.nii.gz", name: "Liver", colormap: "warm" },
  { file: "pancreas.nii.gz", name: "Pancreas", colormap: "plasma" },
  { file: "postcava.nii.gz", name: "Postcava (IVC)", colormap: "cool" },
  { file: "spleen.nii.gz", name: "Spleen", colormap: "violet" },
  { file: "stomach.nii.gz", name: "Stomach", colormap: "gold" },
];

const SWATCH_COLORS = {
  red: "#e64545",
  green: "#3fb950",
  blue: "#4f7dff",
  winter: "#2fb6c9",
  warm: "#e0a233",
  plasma: "#c9438f",
  cool: "#4fd1c5",
  violet: "#9b6ee0",
  gold: "#d4af37",
};

const statusText = document.getElementById("statusText");
const organListEl = document.getElementById("organList");
const loadingOverlay = document.getElementById("loadingOverlay");

// Populated by buildOrganList(); avoids re-querying the DOM for every
// checkbox on every opacity/select-all/select-none interaction.
let organCheckboxes = [];

function setStatus(msg) {
  statusText.textContent = msg;
}

const nv = new Niivue({
  show3Dcrosshair: true,
  backColor: [0, 0, 0, 1],
  onLocationChange: handleLocationChange,
});
nv.attachToCanvas(document.getElementById("gl1"));

function handleLocationChange(data) {
  const readout = document.getElementById("crosshair-readout");
  try {
    const vox = data.vox ? data.vox.map((v) => Math.round(v)).join(", ") : "—";
    let intensity = "—";
    if (Array.isArray(data.values) && data.values.length > 0) {
      const bg = data.values[0];
      if (bg && typeof bg.value === "number") {
        intensity = `${bg.value.toFixed(1)} HU`;
      }
    }
    readout.textContent = `Voxel: [${vox}]  |  Intensity: ${intensity}`;
  } catch (e) {
    // location payload shape can vary across events; readout is best-effort
  }
}

async function init() {
  setStatus("Loading CT volume (16 MB)…");

  // Each organ ships as its own single-label NIfTI mask (BodyMaps' native
  // export format) rather than one combined multi-label volume. Loading them
  // as separate Niivue overlays — instead of merging them first — is what
  // lets each organ get its own colormap and be toggled independently below,
  // mirroring how 3D Slicer treats segments.
  const volumeList = [
    {
      url: "data/ct.nii.gz",
      name: "ct.nii.gz",
      colormap: "gray",
      opacity: 1,
    },
    ...ORGANS.map((o) => ({
      url: `data/segmentations/${o.file}`,
      name: o.file,
      colormap: o.colormap,
      opacity: 0.55,
    })),
  ];

  await nv.loadVolumes(volumeList);

  // CT window/level defaults (soft tissue-ish window over the auto range)
  applyWindow(40, 400);

  nv.setSliceType(nv.sliceTypeMultiplanar);
  nv.setInterpolation(false);
  nv.updateGLVolume();

  buildOrganList();
  loadingOverlay.classList.add("hidden");
  setStatus(
    `Loaded CT (${nv.volumes[0].dims.slice(1, 4).join("×")} voxels) + ${ORGANS.length} organ masks.`
  );
}

function applyWindow(center, width) {
  if (!nv.volumes[0]) return;
  nv.volumes[0].cal_min = center - width / 2;
  nv.volumes[0].cal_max = center + width / 2;
  nv.updateGLVolume();
}

function buildOrganList() {
  organListEl.innerHTML = "";
  organCheckboxes = ORGANS.map((organ, i) => {
    const volIdx = i + 1; // volume 0 is the CT background
    const row = document.createElement("div");
    row.className = "organ-row";

    const swatch = document.createElement("span");
    swatch.className = "organ-swatch";
    swatch.style.background = SWATCH_COLORS[organ.colormap] || "#888";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.id = `organ-${i}`;
    checkbox.addEventListener("change", () => {
      const baseOpacity = Number(document.getElementById("maskOpacity").value) / 100;
      nv.setOpacity(volIdx, checkbox.checked ? baseOpacity : 0);
    });

    const label = document.createElement("label");
    label.htmlFor = `organ-${i}`;
    label.textContent = organ.name;

    row.appendChild(swatch);
    row.appendChild(checkbox);
    row.appendChild(label);
    organListEl.appendChild(row);

    return { checkbox, volIdx };
  });
}

// ---- UI wiring ----

document.getElementById("windowCenter").addEventListener("input", (e) => {
  const width = Number(document.getElementById("windowWidth").value);
  applyWindow(Number(e.target.value), width);
});

document.getElementById("windowWidth").addEventListener("input", (e) => {
  const center = Number(document.getElementById("windowCenter").value);
  applyWindow(center, Number(e.target.value));
});

document.getElementById("presetSoftTissue").addEventListener("click", () => {
  document.getElementById("windowCenter").value = 40;
  document.getElementById("windowWidth").value = 400;
  applyWindow(40, 400);
});
document.getElementById("presetLung").addEventListener("click", () => {
  document.getElementById("windowCenter").value = -600;
  document.getElementById("windowWidth").value = 1500;
  applyWindow(-600, 1500);
});
document.getElementById("presetBone").addEventListener("click", () => {
  document.getElementById("windowCenter").value = 400;
  document.getElementById("windowWidth").value = 1800;
  applyWindow(400, 1800);
});

document.getElementById("maskOpacity").addEventListener("input", (e) => {
  const val = Number(e.target.value) / 100;
  organCheckboxes.forEach(({ checkbox, volIdx }) => {
    if (checkbox.checked) nv.setOpacity(volIdx, val);
  });
});

document.getElementById("selectAll").addEventListener("click", () => {
  const val = Number(document.getElementById("maskOpacity").value) / 100;
  organCheckboxes.forEach(({ checkbox, volIdx }) => {
    checkbox.checked = true;
    nv.setOpacity(volIdx, val);
  });
});
document.getElementById("selectNone").addEventListener("click", () => {
  organCheckboxes.forEach(({ checkbox, volIdx }) => {
    checkbox.checked = false;
    nv.setOpacity(volIdx, 0);
  });
});

document.getElementById("crosshairToggle").addEventListener("change", (e) => {
  nv.opts.crosshairWidth = e.target.checked ? 1 : 0;
  nv.setCrosshairWidth(nv.opts.crosshairWidth);
  nv.updateGLVolume();
});

const layoutButtons = document.querySelectorAll("#layout-buttons button");
layoutButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    layoutButtons.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
    switch (btn.dataset.layout) {
      case "multi":
        nv.setSliceType(nv.sliceTypeMultiplanar);
        break;
      case "axial":
        nv.setSliceType(nv.sliceTypeAxial);
        break;
      case "coronal":
        nv.setSliceType(nv.sliceTypeCoronal);
        break;
      case "sagittal":
        nv.setSliceType(nv.sliceTypeSagittal);
        break;
      case "render":
        nv.setSliceType(nv.sliceTypeRender);
        break;
    }
  });
});

init().catch((err) => {
  console.error(err);
  loadingOverlay.querySelector("p").textContent =
    "Failed to load — this viewer needs a browser with WebGL2 support.";
  setStatus(`Failed to load volumes: ${err.message}`);
});
