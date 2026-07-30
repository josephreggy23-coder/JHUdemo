import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ORGANS } from "../src/catalog";
import {
  computeStructureStats,
  voxelVolumeFromAffine,
  type NumericArray,
} from "../src/statistics";

type ParsedNifti = {
  dimensions: number[];
  spacing: number[];
  affine: number[][];
  slope: number;
  intercept: number;
  data: NumericArray;
};

function parseNifti(path: URL): ParsedNifti {
  const bytes = gunzipSync(readFileSync(path));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = view.getInt32(0, true) === 348;
  if (!littleEndian)
    throw new Error("Reference parser expects little-endian NIfTI-1.");
  const dimensions = [
    view.getInt16(42, true),
    view.getInt16(44, true),
    view.getInt16(46, true),
  ];
  const spacing = [
    view.getFloat32(80, true),
    view.getFloat32(84, true),
    view.getFloat32(88, true),
  ];
  const datatype = view.getInt16(70, true);
  const voxelOffset = Math.floor(view.getFloat32(108, true));
  const voxelCount = dimensions.reduce((product, value) => product * value, 1);
  const affine = [280, 296, 312].map((offset) =>
    [0, 4, 8, 12].map((column) => view.getFloat32(offset + column, true)),
  );
  affine.push([0, 0, 0, 1]);
  const absoluteOffset = bytes.byteOffset + voxelOffset;
  let data: NumericArray;
  switch (datatype) {
    case 2:
    case 256:
      data = new Uint8Array(bytes.buffer, absoluteOffset, voxelCount);
      break;
    case 4:
      data = new Int16Array(bytes.buffer, absoluteOffset, voxelCount);
      break;
    case 512:
      data = new Uint16Array(bytes.buffer, absoluteOffset, voxelCount);
      break;
    case 16:
      data = new Float32Array(bytes.buffer, absoluteOffset, voxelCount);
      break;
    default:
      throw new Error(`Unsupported reference datatype ${datatype}`);
  }
  const rawSlope = view.getFloat32(112, true);
  return {
    dimensions,
    spacing,
    affine,
    slope: rawSlope === 0 ? 1 : rawSlope,
    intercept: view.getFloat32(116, true),
    data,
  };
}

const expected: Record<string, [number, number, number]> = {
  "aorta.nii.gz": [17600, 29.326826, 142.533589],
  "gall_bladder.nii.gz": [10088, 16.809604, 18.462107],
  "kidney_left.nii.gz": [64746, 107.886062, 122.085012],
  "kidney_right.nii.gz": [65365, 108.917499, 128.812949],
  "liver.nii.gz": [944325, 1573.525857, 62.560579],
  "pancreas.nii.gz": [63802, 106.313077, -24.499711],
  "postcava.nii.gz": [27585, 45.964801, 111.769432],
  "spleen.nii.gz": [109422, 182.329544, 94.739401],
  "stomach.nii.gz": [236819, 394.610775, -84.714308],
};

describe("bundled BodyMaps reference case", () => {
  it("reproduces independently verified geometry and organ statistics", () => {
    const ct = parseNifti(new URL("../public/data/ct.nii.gz", import.meta.url));
    expect(ct.dimensions).toEqual([502, 348, 71]);
    expect(ct.spacing[0]).toBeCloseTo(0.81640625, 6);
    expect(ct.spacing[1]).toBeCloseTo(0.81640625, 6);
    expect(ct.spacing[2]).toBeCloseTo(2.5, 7);
    const voxelVolumeMm3 = voxelVolumeFromAffine(ct.affine);

    for (const organ of ORGANS) {
      const mask = parseNifti(
        new URL(`../public/data/segmentations/${organ.file}`, import.meta.url),
      );
      expect(mask.dimensions).toEqual(ct.dimensions);
      expect(mask.affine).toEqual(ct.affine);
      const stats = computeStructureStats(
        ct.data,
        { id: organ.file, name: organ.name, mask: mask.data },
        voxelVolumeMm3,
        ct.slope,
        ct.intercept,
      );
      const golden = expected[organ.file];
      if (!golden)
        throw new Error(`Missing golden reference for ${organ.file}`);
      expect(stats.voxelCount, organ.name).toBe(golden[0]);
      expect(stats.volumeMl, organ.name).toBeCloseTo(golden[1], 2);
      expect(stats.meanHu, organ.name).toBeCloseTo(golden[2], 1);
    }
  }, 30_000);
});
