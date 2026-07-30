export type NumericArray =
  | Float32Array
  | Float64Array
  | Int32Array
  | Uint32Array
  | Int16Array
  | Uint16Array
  | Uint8Array;

export type StructureStats = {
  id: string;
  name: string;
  voxelCount: number;
  intensitySampleCount: number;
  volumeMl: number;
  meanHu: number | null;
  standardDeviationHu: number | null;
  minHu: number | null;
  maxHu: number | null;
};

export type StatsInput = {
  id: string;
  name: string;
  mask: NumericArray;
};

export function voxelVolumeFromAffine(affine: number[][]): number {
  const a = affine[0]?.[0] ?? 0;
  const b = affine[0]?.[1] ?? 0;
  const c = affine[0]?.[2] ?? 0;
  const d = affine[1]?.[0] ?? 0;
  const e = affine[1]?.[1] ?? 0;
  const f = affine[1]?.[2] ?? 0;
  const g = affine[2]?.[0] ?? 0;
  const h = affine[2]?.[1] ?? 0;
  const i = affine[2]?.[2] ?? 0;
  const determinant =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return Math.abs(determinant);
}

export function dimensionsMatch(
  left: number[] | undefined,
  right: number[] | undefined,
): boolean {
  if (!left || !right) return false;
  const leftSpatial = left.slice(1, 4);
  const rightSpatial = right.slice(1, 4);
  return (
    leftSpatial.length === 3 &&
    rightSpatial.length === 3 &&
    leftSpatial.every((value, index) => value === rightSpatial[index])
  );
}

export function affinesMatch(
  left: number[][],
  right: number[][],
  tolerance = 1e-4,
): boolean {
  if (left.length < 4 || right.length < 4) return false;
  return left.slice(0, 4).every((row, rowIndex) =>
    row.slice(0, 4).every((value, columnIndex) => {
      const other = right[rowIndex]?.[columnIndex];
      return other !== undefined && Math.abs(value - other) <= tolerance;
    }),
  );
}

export function computeStructureStats(
  ct: NumericArray,
  input: StatsInput,
  voxelVolumeMm3: number,
  slope = 1,
  intercept = 0,
): StructureStats {
  const length = Math.min(ct.length, input.mask.length);
  let voxelCount = 0;
  let intensitySampleCount = 0;
  let sum = 0;
  let sumSquares = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < length; index += 1) {
    if (Number(input.mask[index] ?? 0) === 0) continue;
    voxelCount += 1;
    const hu = Number(ct[index] ?? 0) * slope + intercept;
    if (!Number.isFinite(hu)) continue;
    intensitySampleCount += 1;
    sum += hu;
    sumSquares += hu * hu;
    if (hu < min) min = hu;
    if (hu > max) max = hu;
  }

  const mean = intensitySampleCount > 0 ? sum / intensitySampleCount : null;
  const variance =
    mean === null
      ? null
      : Math.max(0, sumSquares / intensitySampleCount - mean * mean);

  return {
    id: input.id,
    name: input.name,
    voxelCount,
    intensitySampleCount,
    volumeMl: (voxelCount * voxelVolumeMm3) / 1000,
    meanHu: mean,
    standardDeviationHu: variance === null ? null : Math.sqrt(variance),
    minHu: intensitySampleCount > 0 ? min : null,
    maxHu: intensitySampleCount > 0 ? max : null,
  };
}

export function formatHu(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value)} HU`;
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} L`
    : `${value.toFixed(1)} mL`;
}

export function csvForStats(stats: StructureStats[]): string {
  const rows = [
    [
      "Structure",
      "Voxels",
      "Finite intensity samples",
      "Volume (mL)",
      "Mean HU",
      "Standard deviation HU",
      "Minimum HU",
      "Maximum HU",
    ],
    ...stats.map((item) => [
      item.name,
      String(item.voxelCount),
      String(item.intensitySampleCount),
      item.volumeMl.toFixed(3),
      item.meanHu?.toFixed(3) ?? "",
      item.standardDeviationHu?.toFixed(3) ?? "",
      item.minHu?.toFixed(3) ?? "",
      item.maxHu?.toFixed(3) ?? "",
    ]),
  ];

  return rows
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}
