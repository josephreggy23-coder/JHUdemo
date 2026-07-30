import {
  DRAG_MODE,
  MULTIPLANAR_TYPE,
  NVImage,
  Niivue,
  SHOW_RENDER,
  SLICE_TYPE,
  type NiiVueLocation,
} from "@niivue/niivue";
import "./style.css";
import {
  ORGANS,
  WINDOW_PRESETS,
  colorForIndex,
  colormapForIndex,
  humanizeFilename,
  matchOrgan,
} from "./catalog";
import { classifyFiles, isSupportedMedicalFile } from "./files";
import {
  affinesMatch,
  csvForStats,
  dimensionsMatch,
  formatHu,
  formatVolume,
  voxelVolumeFromAffine,
  type NumericArray,
  type StructureStats,
} from "./statistics";
import {
  EMPTY_REVIEW,
  makeReviewReport,
  safeCaseStorageKey,
  type ReviewDraft,
  type ReviewReport,
  type ReviewStatus,
} from "./review";

type CaseSource = ReviewReport["source"];

type ViewerStructure = {
  id: string;
  name: string;
  fileName: string;
  volumeIndex: number;
  volumeId: string;
  color: string;
  colormap: string;
  visible: boolean;
  flagged: boolean;
  geometryValid: boolean;
  stats: StructureStats | null;
};

type SerializedArray = {
  kind: NumericArray["constructor"]["name"];
  buffer: ArrayBuffer;
};

const must = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element)
    throw new Error(`Missing required interface element: ${selector}`);
  return element;
};

const canvas = must<HTMLCanvasElement>("#gl1");
const body = document.body;
const loadingOverlay = must<HTMLElement>("#loadingOverlay");
const loadingTitle = must<HTMLElement>("#loadingTitle");
const loadingDetail = must<HTMLElement>("#loadingDetail");
const progressBar = must<HTMLElement>("#progressBar");
const progressTrack = must<HTMLElement>(".progress-track");
const dropTarget = must<HTMLElement>("#dropTarget");
const dropOverlay = must<HTMLElement>("#dropOverlay");
const toast = must<HTMLElement>("#toast");
const fileInput = must<HTMLInputElement>("#fileInput");
const folderInput = must<HTMLInputElement>("#folderInput");
const structureList = must<HTMLElement>("#structureList");
const structureSearch = must<HTMLInputElement>("#structureSearch");
const windowPreset = must<HTMLSelectElement>("#windowPreset");
const windowCenter = must<HTMLInputElement>("#windowCenter");
const windowWidth = must<HTMLInputElement>("#windowWidth");
const maskOpacity = must<HTMLInputElement>("#maskOpacity");
const crosshairToggle = must<HTMLInputElement>("#crosshairToggle");
const radiologicalToggle = must<HTMLInputElement>("#radiologicalToggle");
const interpolationToggle = must<HTMLInputElement>("#interpolationToggle");
const brushSize = must<HTMLInputElement>("#brushSize");
const reviewStatus = must<HTMLSelectElement>("#reviewStatus");
const reviewNotes = must<HTMLTextAreaElement>("#reviewNotes");
const helpDialog = must<HTMLDialogElement>("#helpDialog");

let structures: ViewerStructure[] = [];
let currentCaseName = "BDMAP_00000338";
let currentSource: CaseSource = "sample";
let currentDimensions: number[] = [];
let currentSpacing: number[] = [];
let currentLayout = "multi";
let overlayOpacity = 0.55;
let review: ReviewDraft = { ...EMPTY_REVIEW };
let toastTimer = 0;
let dragDepth = 0;
let statsWorker: Worker | null = null;

const nv = new Niivue({
  backColor: [0.005, 0.012, 0.011, 1],
  crosshairColor: [0.42, 0.89, 0.76, 0.9],
  crosshairWidth: 1,
  crosshairWidthUnit: "voxels",
  dragAndDropEnabled: false,
  isResizeCanvas: true,
  isSliceMM: true,
  isRadiologicalConvention: true,
  isOrientationTextVisible: true,
  showAllOrientationMarkers: true,
  isOrientCube: true,
  show3Dcrosshair: true,
  multiplanarEqualSize: true,
  multiplanarLayout: MULTIPLANAR_TYPE.GRID,
  multiplanarPadPixels: 3,
  multiplanarShowRender: SHOW_RENDER.ALWAYS,
  sliceType: SLICE_TYPE.MULTIPLANAR,
  textHeight: 0.022,
  measureLineColor: [0.42, 0.89, 0.76, 1],
  measureTextColor: [0.92, 0.98, 0.96, 1],
  showMeasureUnits: true,
  loadingText: "Loading medical image…",
});

nv.onLocationChange = (rawLocation) => {
  updateLocationReadout(rawLocation as NiiVueLocation);
};

nv.onIntensityChange = (volume) => {
  if (volume !== nv.volumes[0]) return;
  const center = ((volume.cal_min ?? 0) + (volume.cal_max ?? 0)) / 2;
  const width = Math.max(1, (volume.cal_max ?? 1) - (volume.cal_min ?? 0));
  syncWindowControls(center, width, false);
};

function setLoading(title: string, detail: string, progress: number): void {
  body.dataset.loadState = "loading";
  loadingTitle.textContent = title;
  loadingDetail.textContent = detail;
  loadingOverlay.classList.remove("hidden");
  const clamped = Math.max(0, Math.min(100, progress));
  progressBar.style.width = `${clamped}%`;
  progressTrack.setAttribute("aria-valuenow", String(clamped));
  must<HTMLElement>("#caseState").textContent = "Loading";
  must<HTMLElement>("#caseState").className = "ready-pill";
}

function setReady(message = "Ready"): void {
  body.dataset.loadState = "ready";
  loadingOverlay.classList.add("hidden");
  const state = must<HTMLElement>("#caseState");
  state.textContent = message;
  state.className = "ready-pill ready";
}

function setError(message: string): void {
  body.dataset.loadState = "error";
  loadingTitle.textContent = "Unable to open this case";
  loadingDetail.textContent = message;
  progressBar.style.width = "100%";
  progressBar.style.background = "var(--danger)";
  const state = must<HTMLElement>("#caseState");
  state.textContent = "Error";
  state.className = "ready-pill error";
  showToast(message, true);
}

function showToast(message: string, isError = false): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast visible${isError ? " error" : ""}`;
  toastTimer = window.setTimeout(() => {
    toast.className = "toast";
  }, 4200);
}

function formatNumber(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function updateLocationReadout(location: NiiVueLocation): void {
  if (!location || !Array.isArray(location.vox) || !Array.isArray(location.mm))
    return;
  must<HTMLOutputElement>("#voxelReadout").value = location.vox
    .slice(0, 3)
    .map((value) => Math.round(value))
    .join(", ");
  must<HTMLOutputElement>("#patientReadout").value =
    location.mm
      .slice(0, 3)
      .map((value) => formatNumber(value, 1))
      .join(", ") + " mm";

  const baseId = nv.volumes[0]?.id;
  const baseValue = location.values?.find(
    (value) => value.id === baseId,
  )?.value;
  must<HTMLOutputElement>("#intensityReadout").value =
    typeof baseValue === "number" && Number.isFinite(baseValue)
      ? `${baseValue.toFixed(1)} HU`
      : "—";

  const activeStructure = structures.find((structure) => {
    const value = location.values?.find(
      (entry) => entry.id === structure.volumeId,
    )?.value;
    return typeof value === "number" && value !== 0;
  });
  must<HTMLOutputElement>("#structureReadout").value =
    activeStructure?.name ?? "—";
}

function clearViewer(): void {
  statsWorker?.terminate();
  statsWorker = null;
  nv.setDrawingEnabled(false);
  if (nv.drawBitmap) nv.closeDrawing();
  nv.clearAllMeasurements();
  while (nv.volumes.length > 0) {
    nv.removeVolumeByIndex(nv.volumes.length - 1);
  }
  structures = [];
  renderStructures();
}

function updateCaseMetadata(): void {
  must<HTMLElement>("#caseName").textContent = currentCaseName;
  must<HTMLElement>("#dimensionsValue").textContent =
    currentDimensions.length === 3 ? currentDimensions.join(" × ") : "—";
  must<HTMLElement>("#spacingValue").textContent =
    currentSpacing.length === 3
      ? `${currentSpacing.map((value) => formatNumber(value, 2)).join(" × ")} mm`
      : "—";
  must<HTMLElement>("#sourceValue").textContent =
    currentSource === "sample"
      ? "Bundled NIfTI"
      : currentSource === "local-dicom"
        ? "Local DICOM"
        : "Local NIfTI";
  must<HTMLElement>("#structureCount").textContent = String(structures.length);
}

function configureViewerAfterLoad(): void {
  nv.setSliceMM(true);
  nv.setRadiologicalConvention(radiologicalToggle.checked);
  nv.setInterpolation(!interpolationToggle.checked);
  nv.setCrosshairWidth(crosshairToggle.checked ? 1 : 0);
  nv.setMultiplanarLayout(MULTIPLANAR_TYPE.GRID);
  nv.setMultiplanarPadPixels(3);
  nv.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS;
  nv.opts.multiplanarEqualSize = true;
  nv.setVolumeRenderIllumination(0.65).catch(() => undefined);
  nv.setRenderAzimuthElevation(115, 18);
  setLayout("multi");
  setMode("inspect");
  applyWindow(40, 400);
}

function makeStructuresFromLoadedVolumes(names: string[]): ViewerStructure[] {
  return names.map((fileName, index) => {
    const known = matchOrgan(fileName);
    const volume = nv.volumes[index + 1];
    return {
      id: known?.file ?? `${fileName}-${index}`,
      name: known?.name ?? humanizeFilename(fileName),
      fileName,
      volumeIndex: index + 1,
      volumeId: volume?.id ?? "",
      color: known?.color ?? colorForIndex(index),
      colormap: known?.colormap ?? colormapForIndex(index),
      visible: true,
      flagged: false,
      geometryValid: true,
      stats: null,
    };
  });
}

async function finishCaseLoad(
  caseName: string,
  source: CaseSource,
  structureNames: string[],
): Promise<void> {
  currentCaseName = caseName;
  currentSource = source;
  const base = nv.volumes[0];
  if (!base) throw new Error("No primary scan was created.");

  currentDimensions = (base.dimsRAS ?? base.dims ?? []).slice(1, 4).map(Number);
  currentSpacing = (base.pixDimsRAS ?? base.pixDims ?? [])
    .slice(1, 4)
    .map((value) => Math.abs(Number(value)));
  structures = makeStructuresFromLoadedVolumes(structureNames);
  validateStructureGeometry();
  configureViewerAfterLoad();
  loadReview();
  updateCaseMetadata();
  renderStructures();
  setReady();
  showToast(
    `Loaded ${currentCaseName}: ${currentDimensions.join(" × ")} with ${structures.length} structure${structures.length === 1 ? "" : "s"}.`,
  );
  if (structures.length > 0) {
    await calculateStatistics();
  }
}

async function loadSampleCase(): Promise<void> {
  setLoading(
    "Preparing sample case",
    "Loading CT volume and nine segmentation masks…",
    12,
  );
  clearViewer();
  const basePath = import.meta.env.BASE_URL;
  const volumeList = [
    {
      url: `${basePath}data/ct.nii.gz`,
      name: "ct.nii.gz",
      colormap: "gray",
      opacity: 1,
    },
    ...ORGANS.map((organ) => ({
      url: `${basePath}data/segmentations/${organ.file}`,
      name: organ.file,
      colormap: organ.colormap,
      opacity: overlayOpacity,
    })),
  ];
  progressBar.style.width = "35%";
  await nv.loadVolumes(volumeList);
  progressBar.style.width = "78%";
  await finishCaseLoad(
    "BDMAP_00000338",
    "sample",
    ORGANS.map((organ) => organ.file),
  );
}

async function loadNiftiFiles(files: File[]): Promise<void> {
  const classified = classifyFiles(files);
  if (!classified.ct) {
    throw new Error("No CT volume was found. Include a .nii or .nii.gz scan.");
  }
  setLoading(
    "Opening NIfTI case",
    "Parsing the CT volume and segmentation masks locally…",
    10,
  );
  clearViewer();

  const ct = await NVImage.loadFromFile({
    file: classified.ct,
    name: classified.ct.name,
    colormap: "gray",
    opacity: 1,
  });
  nv.addVolume(ct);
  progressBar.style.width = "42%";

  const loadedStructureNames: string[] = [];
  for (let index = 0; index < classified.structures.length; index += 1) {
    const structure = classified.structures[index];
    if (!structure) continue;
    const known = matchOrgan(structure.file.name);
    const image = await NVImage.loadFromFile({
      file: structure.file,
      name: structure.file.name,
      colormap: known?.colormap ?? colormapForIndex(index),
      opacity: overlayOpacity,
    });
    nv.addVolume(image);
    loadedStructureNames.push(structure.file.name);
    const completion =
      42 + Math.round(((index + 1) / classified.structures.length) * 40);
    progressBar.style.width = `${completion}%`;
  }

  const caseName =
    classified.ct.webkitRelativePath?.split("/").filter(Boolean)[0] ||
    classified.ct.name.replace(/\.nii(\.gz)?$/i, "");
  await finishCaseLoad(caseName, "local-nifti", loadedStructureNames);

  if (classified.ignored.length > 0) {
    showToast(
      `${classified.ignored.length} unsupported file(s) were safely ignored.`,
    );
  }
}

async function loadDicomFiles(files: File[]): Promise<void> {
  setLoading(
    "Converting DICOM locally",
    `Preparing ${files.length} file${files.length === 1 ? "" : "s"} with dcm2niix in this browser…`,
    8,
  );
  clearViewer();
  const { dicomLoader } = await import("@niivue/dicom-loader");
  const converted = await dicomLoader(files);
  if (converted.length === 0) {
    throw new Error(
      "The DICOM folder did not contain a readable imaging series.",
    );
  }
  progressBar.style.width = "70%";
  const primary = [...converted].sort(
    (left, right) => right.data.byteLength - left.data.byteLength,
  )[0];
  if (!primary) throw new Error("DICOM conversion did not create an image.");
  const file = new File([primary.data], primary.name || "converted-series.nii");
  const image = await NVImage.loadFromFile({
    file,
    name: file.name,
    colormap: "gray",
    opacity: 1,
  });
  nv.addVolume(image);
  const folderName =
    files[0]?.webkitRelativePath?.split("/").filter(Boolean)[0] ??
    "Local DICOM series";
  await finishCaseLoad(folderName, "local-dicom", []);
  if (converted.length > 1) {
    showToast(
      `DICOM conversion produced ${converted.length} series. The largest series was opened as the primary scan.`,
    );
  }
}

async function openFiles(inputFiles: Iterable<File>): Promise<void> {
  const files = Array.from(inputFiles).filter(isSupportedMedicalFile);
  if (files.length === 0) {
    showToast("Choose NIfTI files or a folder containing DICOM files.", true);
    return;
  }
  try {
    const classified = classifyFiles(files);
    if (classified.kind === "dicom") {
      await loadDicomFiles(classified.dicomFiles);
    } else {
      await loadNiftiFiles(files);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The case could not be opened.";
    setError(message);
  } finally {
    fileInput.value = "";
    folderInput.value = "";
  }
}

function validateStructureGeometry(): void {
  const base = nv.volumes[0];
  if (!base) return;
  const baseAffine = nv.getVolumeAffine(0);
  structures.forEach((structure) => {
    const volume = nv.volumes[structure.volumeIndex];
    if (!volume) {
      structure.geometryValid = false;
      return;
    }
    structure.geometryValid =
      dimensionsMatch(
        base.dimsRAS ?? base.dims,
        volume.dimsRAS ?? volume.dims,
      ) && affinesMatch(baseAffine, nv.getVolumeAffine(structure.volumeIndex));
  });
  const invalidCount = structures.filter(
    (structure) => !structure.geometryValid,
  ).length;
  if (invalidCount > 0) {
    showToast(
      `${invalidCount} segmentation${invalidCount === 1 ? "" : "s"} did not match the CT geometry and were excluded from statistics.`,
      true,
    );
  }
}

function copyNumericArray(array: NumericArray): SerializedArray {
  if (array instanceof Float32Array) {
    return { kind: "Float32Array", buffer: new Float32Array(array).buffer };
  }
  if (array instanceof Float64Array) {
    return { kind: "Float64Array", buffer: new Float64Array(array).buffer };
  }
  if (array instanceof Int32Array) {
    return { kind: "Int32Array", buffer: new Int32Array(array).buffer };
  }
  if (array instanceof Uint32Array) {
    return { kind: "Uint32Array", buffer: new Uint32Array(array).buffer };
  }
  if (array instanceof Int16Array) {
    return { kind: "Int16Array", buffer: new Int16Array(array).buffer };
  }
  if (array instanceof Uint16Array) {
    return { kind: "Uint16Array", buffer: new Uint16Array(array).buffer };
  }
  return { kind: "Uint8Array", buffer: new Uint8Array(array).buffer };
}

async function calculateStatistics(): Promise<void> {
  const ctVolume = nv.volumes[0];
  if (!ctVolume?.img) return;
  const validStructures = structures.filter(
    (structure) => structure.geometryValid,
  );
  if (validStructures.length === 0) return;

  must<HTMLElement>("#renderStatus").textContent = "Computing statistics…";
  statsWorker?.terminate();
  const worker = new Worker(new URL("./stats.worker.ts", import.meta.url), {
    type: "module",
  });
  statsWorker = worker;
  const affine = nv.getVolumeAffine(0);
  const voxelVolumeMm3 = voxelVolumeFromAffine(affine);
  const header = ctVolume.hdr as {
    scl_slope?: number;
    scl_inter?: number;
  } | null;
  const rawSlope = Number(header?.scl_slope ?? 1);
  const slope = rawSlope === 0 || !Number.isFinite(rawSlope) ? 1 : rawSlope;
  const rawIntercept = Number(header?.scl_inter ?? 0);
  const intercept = Number.isFinite(rawIntercept) ? rawIntercept : 0;

  const ct = copyNumericArray(ctVolume.img);
  const masks = validStructures.flatMap((structure) => {
    const image = nv.volumes[structure.volumeIndex];
    if (!image?.img) return [];
    return [
      {
        id: structure.id,
        name: structure.name,
        data: copyNumericArray(image.img),
      },
    ];
  });
  const transfers = [ct.buffer, ...masks.map((mask) => mask.data.buffer)];

  const results = await new Promise<StructureStats[]>((resolve, reject) => {
    worker.addEventListener(
      "message",
      (event: MessageEvent<StructureStats[]>) => resolve(event.data),
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => reject(new Error("The statistics worker stopped unexpectedly.")),
      { once: true },
    );
    worker.postMessage(
      { ct, masks, voxelVolumeMm3, slope, intercept },
      transfers,
    );
  }).finally(() => {
    worker.terminate();
    if (statsWorker === worker) statsWorker = null;
  });

  results.forEach((result) => {
    const structure = structures.find((item) => item.id === result.id);
    if (structure) structure.stats = result;
  });
  renderStructures();
  must<HTMLButtonElement>("#downloadStatsButton").disabled =
    results.length === 0;
  must<HTMLElement>("#renderStatus").textContent = "WebGL2 · local";
}

function renderStructures(): void {
  const query = structureSearch.value.trim().toLowerCase();
  const shown = structures.filter((structure) =>
    structure.name.toLowerCase().includes(query),
  );
  structureList.replaceChildren();
  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent =
      structures.length === 0
        ? "No segmentation masks are loaded."
        : "No structures match this search.";
    structureList.append(empty);
    return;
  }

  shown.forEach((structure) => {
    const row = document.createElement("div");
    row.className = `structure-row${structure.visible ? "" : " hidden-structure"}`;
    row.style.setProperty("--structure-color", structure.color);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "structure-check";
    checkbox.checked = structure.visible;
    checkbox.setAttribute("aria-label", `Show ${structure.name}`);
    checkbox.addEventListener("change", () => {
      structure.visible = checkbox.checked;
      applyStructureOpacity(structure);
      renderStructures();
    });

    const main = document.createElement("div");
    main.className = "structure-main";
    const name = document.createElement("span");
    name.className = "structure-name";
    name.textContent = structure.name;
    if (!structure.geometryValid) name.title = "Geometry does not match the CT";
    const stats = document.createElement("span");
    stats.className = "structure-stats";
    if (!structure.geometryValid) {
      stats.textContent = "Geometry mismatch";
    } else if (structure.stats) {
      stats.textContent = `${formatVolume(structure.stats.volumeMl)} · ${formatHu(structure.stats.meanHu)}`;
      stats.title = `Mean ${formatHu(structure.stats.meanHu)}, SD ${formatHu(structure.stats.standardDeviationHu)}, range ${formatHu(structure.stats.minHu)} to ${formatHu(structure.stats.maxHu)}`;
    } else {
      stats.textContent = "Calculating…";
    }
    main.append(name, stats);

    const solo = document.createElement("button");
    solo.type = "button";
    solo.className = "structure-icon-button";
    solo.textContent = "◎";
    solo.title = `Show only ${structure.name}`;
    solo.setAttribute("aria-label", `Show only ${structure.name}`);
    solo.addEventListener("click", () => {
      const isOnlyVisible =
        structure.visible &&
        structures.filter((item) => item.visible).length === 1;
      structures.forEach((item) => {
        item.visible = isOnlyVisible || item === structure;
        applyStructureOpacity(item);
      });
      renderStructures();
    });

    const flag = document.createElement("button");
    flag.type = "button";
    flag.className = "structure-icon-button";
    flag.textContent = "⚑";
    flag.title = structure.flagged
      ? `Remove flag from ${structure.name}`
      : `Flag ${structure.name}`;
    flag.setAttribute("aria-label", flag.title);
    flag.setAttribute("aria-pressed", String(structure.flagged));
    flag.addEventListener("click", () => {
      structure.flagged = !structure.flagged;
      syncReviewFromInterface();
      saveReview();
      renderStructures();
    });
    row.append(checkbox, main, solo, flag);
    structureList.append(row);
  });
}

function applyStructureOpacity(structure: ViewerStructure): void {
  const currentIndex = nv.volumes.findIndex(
    (volume) => volume.id === structure.volumeId,
  );
  if (currentIndex < 0) return;
  structure.volumeIndex = currentIndex;
  nv.setOpacity(currentIndex, structure.visible ? overlayOpacity : 0);
}

function setAllStructures(visible: boolean): void {
  structures.forEach((structure) => {
    structure.visible = visible;
    applyStructureOpacity(structure);
  });
  renderStructures();
}

function applyWindow(center: number, width: number): void {
  const volume = nv.volumes[0];
  if (!volume || !Number.isFinite(center) || !Number.isFinite(width)) return;
  const safeWidth = Math.max(1, width);
  volume.cal_min = center - safeWidth / 2;
  volume.cal_max = center + safeWidth / 2;
  nv.updateGLVolume();
  syncWindowControls(center, safeWidth, false);
}

function syncWindowControls(
  center: number,
  width: number,
  updateViewer = true,
): void {
  const roundedCenter = Math.round(center);
  const roundedWidth = Math.max(1, Math.round(width));
  if (roundedCenter < Number(windowCenter.min))
    windowCenter.min = String(roundedCenter);
  if (roundedCenter > Number(windowCenter.max))
    windowCenter.max = String(roundedCenter);
  if (roundedWidth > Number(windowWidth.max))
    windowWidth.max = String(roundedWidth);
  windowCenter.value = String(roundedCenter);
  windowWidth.value = String(roundedWidth);
  must<HTMLOutputElement>("#centerValue").value = String(roundedCenter);
  must<HTMLOutputElement>("#widthValue").value = String(roundedWidth);
  must<HTMLOutputElement>("#windowReadout").value =
    `W ${roundedWidth} · L ${roundedCenter}`;
  if (updateViewer) applyWindow(roundedCenter, roundedWidth);
}

function setLayout(layout: string): void {
  currentLayout = layout;
  const layoutMap: Record<string, SLICE_TYPE> = {
    multi: SLICE_TYPE.MULTIPLANAR,
    axial: SLICE_TYPE.AXIAL,
    coronal: SLICE_TYPE.CORONAL,
    sagittal: SLICE_TYPE.SAGITTAL,
    render: SLICE_TYPE.RENDER,
  };
  nv.setSliceType(layoutMap[layout] ?? SLICE_TYPE.MULTIPLANAR);
  document
    .querySelectorAll<HTMLButtonElement>("[data-layout]")
    .forEach((button) => {
      const isActive = button.dataset.layout === layout;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
}

function ensureDrawing(): void {
  if (!nv.volumes[0]) {
    showToast("Open a scan before starting an edit.", true);
    return;
  }
  if (!nv.drawBitmap) {
    nv.createEmptyDrawing();
    nv.setDrawColormap("$itksnap");
    nv.setDrawOpacity(0.72);
  }
}

function setMode(mode: string): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      const isActive = button.dataset.mode === mode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

  nv.setDrawingEnabled(false);
  if (mode === "paint" || mode === "erase") {
    ensureDrawing();
    nv.setDrawingEnabled(true);
    nv.opts.penSize = Number(brushSize.value);
    nv.setPenValue(mode === "paint" ? 1 : 0, false);
    must<HTMLElement>("#canvasHint").textContent =
      mode === "paint"
        ? "Paint correction layer · Undo is available"
        : "Erase correction layer · Undo is available";
    return;
  }

  const primary =
    mode === "ruler"
      ? DRAG_MODE.measurement
      : mode === "angle"
        ? DRAG_MODE.angle
        : DRAG_MODE.crosshair;
  nv.setMouseEventConfig({
    leftButton: {
      primary,
      withShift: DRAG_MODE.measurement,
      withCtrl: DRAG_MODE.angle,
    },
    rightButton: DRAG_MODE.windowing,
    centerButton: DRAG_MODE.pan,
  });
  must<HTMLElement>("#canvasHint").textContent =
    mode === "ruler"
      ? "Drag between two points to measure distance"
      : mode === "angle"
        ? "Draw two connected lines to measure an angle"
        : "Scroll slices · right-drag window/level · middle-drag pan";
}

function resetView(): void {
  nv.scene.crosshairPos = [0.5, 0.5, 0.5];
  nv.scene.pan2Dxyzmm = [0, 0, 0, 1];
  nv.setRenderAzimuthElevation(115, 18);
  setLayout(currentLayout);
  nv.drawScene();
  showToast("View position reset.");
}

function reviewFromStorage(): ReviewDraft {
  try {
    const stored = localStorage.getItem(safeCaseStorageKey(currentCaseName));
    if (!stored) return { ...EMPTY_REVIEW, flaggedStructures: [] };
    const parsed = JSON.parse(stored) as Partial<ReviewDraft>;
    return {
      status:
        parsed.status === "approved" || parsed.status === "needs-attention"
          ? parsed.status
          : "not-reviewed",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      flaggedStructures: Array.isArray(parsed.flaggedStructures)
        ? parsed.flaggedStructures.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
    };
  } catch {
    return { ...EMPTY_REVIEW, flaggedStructures: [] };
  }
}

function loadReview(): void {
  review = reviewFromStorage();
  reviewStatus.value = review.status;
  reviewNotes.value = review.notes;
  structures.forEach((structure) => {
    structure.flagged = review.flaggedStructures.includes(structure.id);
  });
}

function syncReviewFromInterface(): void {
  review = {
    status: reviewStatus.value as ReviewStatus,
    notes: reviewNotes.value,
    flaggedStructures: structures
      .filter((structure) => structure.flagged)
      .map((structure) => structure.id),
  };
}

function saveReview(): void {
  syncReviewFromInterface();
  try {
    localStorage.setItem(
      safeCaseStorageKey(currentCaseName),
      JSON.stringify(review),
    );
  } catch {
    showToast("This browser could not save the review draft locally.", true);
  }
}

function downloadBlob(content: BlobPart, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return (
    value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") ||
    "bodymaps-case"
  );
}

function exportReviewReport(): void {
  saveReview();
  const report = makeReviewReport(
    currentCaseName,
    currentSource,
    currentDimensions,
    currentSpacing,
    review,
    structures.flatMap((structure) =>
      structure.stats ? [structure.stats] : [],
    ),
  );
  downloadBlob(
    JSON.stringify(report, null, 2),
    `${safeFilename(currentCaseName)}-qc-report.json`,
    "application/json",
  );
  showToast("QC report exported.");
}

function exportStats(): void {
  const stats = structures.flatMap((structure) =>
    structure.stats ? [structure.stats] : [],
  );
  if (stats.length === 0) return;
  downloadBlob(
    csvForStats(stats),
    `${safeFilename(currentCaseName)}-statistics.csv`,
    "text/csv;charset=utf-8",
  );
  showToast("Structure statistics exported.");
}

function clearMeasurementsAndDrawing(): void {
  const hasWork =
    Boolean(nv.drawBitmap) || nv.document.completedMeasurements.length > 0;
  if (
    hasWork &&
    !window.confirm("Clear all measurements and the correction layer?")
  )
    return;
  nv.clearAllMeasurements();
  nv.setDrawingEnabled(false);
  if (nv.drawBitmap) nv.closeDrawing();
  setMode("inspect");
  showToast("Measurements and correction layer cleared.");
}

function populatePresets(): void {
  windowPreset.replaceChildren();
  WINDOW_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.name} · W${preset.width} L${preset.center}`;
    windowPreset.append(option);
  });
}

function bindInterface(): void {
  must<HTMLButtonElement>("#openCaseButton").addEventListener("click", () =>
    fileInput.click(),
  );
  must<HTMLButtonElement>("#openFolderButton").addEventListener("click", () =>
    folderInput.click(),
  );
  fileInput.addEventListener("change", () => openFiles(fileInput.files ?? []));
  folderInput.addEventListener("change", () =>
    openFiles(folderInput.files ?? []),
  );

  document
    .querySelectorAll<HTMLButtonElement>("[data-layout]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        setLayout(button.dataset.layout ?? "multi"),
      );
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        setMode(button.dataset.mode ?? "inspect"),
      );
    });

  windowPreset.addEventListener("change", () => {
    const preset = WINDOW_PRESETS.find(
      (item) => item.id === windowPreset.value,
    );
    if (preset) applyWindow(preset.center, preset.width);
  });
  windowCenter.addEventListener("input", () =>
    syncWindowControls(Number(windowCenter.value), Number(windowWidth.value)),
  );
  windowWidth.addEventListener("input", () =>
    syncWindowControls(Number(windowCenter.value), Number(windowWidth.value)),
  );

  maskOpacity.addEventListener("input", () => {
    overlayOpacity = Number(maskOpacity.value) / 100;
    must<HTMLOutputElement>("#opacityValue").value = `${maskOpacity.value}%`;
    structures.forEach(applyStructureOpacity);
  });
  crosshairToggle.addEventListener("change", () =>
    nv.setCrosshairWidth(crosshairToggle.checked ? 1 : 0),
  );
  radiologicalToggle.addEventListener("change", () =>
    nv.setRadiologicalConvention(radiologicalToggle.checked),
  );
  interpolationToggle.addEventListener("change", () =>
    nv.setInterpolation(!interpolationToggle.checked),
  );
  brushSize.addEventListener("input", () => {
    nv.opts.penSize = Number(brushSize.value);
    must<HTMLOutputElement>("#brushSizeValue").value = `${brushSize.value} vox`;
  });

  structureSearch.addEventListener("input", renderStructures);
  must<HTMLButtonElement>("#showAllButton").addEventListener("click", () =>
    setAllStructures(true),
  );
  must<HTMLButtonElement>("#hideAllButton").addEventListener("click", () =>
    setAllStructures(false),
  );
  must<HTMLButtonElement>("#downloadStatsButton").addEventListener(
    "click",
    exportStats,
  );
  must<HTMLButtonElement>("#exportReportButton").addEventListener(
    "click",
    exportReviewReport,
  );
  must<HTMLButtonElement>("#undoButton").addEventListener("click", () => {
    if (!nv.drawBitmap) {
      showToast("There is no correction layer to undo.", true);
      return;
    }
    nv.drawUndo();
    showToast("Last edit undone.");
  });
  must<HTMLButtonElement>("#saveMaskButton").addEventListener(
    "click",
    async () => {
      if (!nv.drawBitmap) {
        showToast("Paint a correction layer before exporting.", true);
        return;
      }
      await nv.saveImage({
        filename: `${safeFilename(currentCaseName)}-corrections.nii.gz`,
        isSaveDrawing: true,
        volumeByIndex: 0,
      });
      showToast("Correction layer exported as NIfTI.");
    },
  );
  must<HTMLButtonElement>("#clearToolsButton").addEventListener(
    "click",
    clearMeasurementsAndDrawing,
  );
  must<HTMLButtonElement>("#resetViewButton").addEventListener(
    "click",
    resetView,
  );
  must<HTMLButtonElement>("#savePngButton").addEventListener(
    "click",
    async () => {
      await nv.saveScene(`${safeFilename(currentCaseName)}-viewer.png`);
      showToast("PNG export started.");
    },
  );

  reviewStatus.addEventListener("change", saveReview);
  reviewNotes.addEventListener("input", saveReview);
  must<HTMLButtonElement>("#helpButton").addEventListener("click", () =>
    helpDialog.showModal(),
  );

  dropTarget.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.classList.add("visible");
  });
  dropTarget.addEventListener("dragover", (event) => event.preventDefault());
  dropTarget.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay.classList.remove("visible");
  });
  dropTarget.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove("visible");
    if (event.dataTransfer?.files) openFiles(event.dataTransfer.files);
  });

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    const shortcuts: Record<string, () => void> = {
      f: () => setLayout("multi"),
      a: () => setLayout("axial"),
      c: () => setLayout("coronal"),
      s: () => setLayout("sagittal"),
      v: () => setLayout("render"),
      r: () => setMode("ruler"),
      escape: () => setMode("inspect"),
    };
    const preset = WINDOW_PRESETS.find((item) => item.shortcut === event.key);
    if (preset) {
      windowPreset.value = preset.id;
      applyWindow(preset.center, preset.width);
      event.preventDefault();
      return;
    }
    if (shortcuts[key]) {
      shortcuts[key]();
      event.preventDefault();
    }
  });
}

async function registerOfflineWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch {
    // Offline installation is an enhancement; viewer functionality is unaffected.
  }
}

async function start(): Promise<void> {
  populatePresets();
  bindInterface();
  await nv.attachToCanvas(canvas);
  await loadSampleCase();
  await registerOfflineWorker();
}

start().catch((error) => {
  const message =
    error instanceof Error ? error.message : "The viewer could not start.";
  setError(message);
});
