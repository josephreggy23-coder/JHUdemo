import { describe, expect, it } from "vitest";
import {
  affinesMatch,
  computeStructureStats,
  csvForStats,
  dimensionsMatch,
  voxelVolumeFromAffine,
} from "../src/statistics";

describe("medical geometry", () => {
  it("uses the affine determinant for orthogonal voxel volume", () => {
    expect(
      voxelVolumeFromAffine([
        [0.8, 0, 0, 10],
        [0, 0.8, 0, 20],
        [0, 0, 2.5, 30],
        [0, 0, 0, 1],
      ]),
    ).toBeCloseTo(1.6, 8);
  });

  it("remains correct for a sheared affine", () => {
    const affine = [
      [1, 0.5, 0, 0],
      [0, 2, 0.25, 0],
      [0, 0, 3, 0],
      [0, 0, 0, 1],
    ];
    expect(voxelVolumeFromAffine(affine)).toBeCloseTo(6, 8);
  });

  it("validates dimensions and affine values with tolerance", () => {
    expect(dimensionsMatch([3, 10, 20, 30], [3, 10, 20, 30])).toBe(true);
    expect(dimensionsMatch([3, 10, 20, 30], [3, 10, 20, 31])).toBe(false);
    const identity = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const close = identity.map((row) => [...row]);
    close[0]![3] = 0.00005;
    expect(affinesMatch(identity, close)).toBe(true);
    close[0]![3] = 0.01;
    expect(affinesMatch(identity, close)).toBe(false);
  });
});

describe("structure statistics", () => {
  it("computes calibrated HU and physical volume", () => {
    const stats = computeStructureStats(
      new Int16Array([0, 10, 20, 30]),
      {
        id: "liver",
        name: "Liver",
        mask: new Uint8Array([0, 1, 1, 0]),
      },
      2,
      2,
      -100,
    );
    expect(stats.voxelCount).toBe(2);
    expect(stats.intensitySampleCount).toBe(2);
    expect(stats.volumeMl).toBeCloseTo(0.004);
    expect(stats.meanHu).toBe(-70);
    expect(stats.standardDeviationHu).toBe(10);
    expect(stats.minHu).toBe(-80);
    expect(stats.maxHu).toBe(-60);
  });

  it("keeps mask volume valid when CT contains non-finite samples", () => {
    const stats = computeStructureStats(
      new Float32Array([10, Number.NaN, Number.POSITIVE_INFINITY]),
      {
        id: "mask",
        name: "Mask",
        mask: new Uint8Array([1, 1, 1]),
      },
      1.5,
    );
    expect(stats.voxelCount).toBe(3);
    expect(stats.intensitySampleCount).toBe(1);
    expect(stats.volumeMl).toBeCloseTo(0.0045);
    expect(stats.meanHu).toBe(10);
  });

  it("returns null intensity values for an empty mask", () => {
    const stats = computeStructureStats(
      new Int16Array([0, 1]),
      { id: "empty", name: "Empty", mask: new Uint8Array([0, 0]) },
      1,
    );
    expect(stats.voxelCount).toBe(0);
    expect(stats.meanHu).toBeNull();
    expect(stats.standardDeviationHu).toBeNull();
    expect(stats.minHu).toBeNull();
    expect(stats.maxHu).toBeNull();
  });

  it("exports spreadsheet-safe CSV", () => {
    const stats = computeStructureStats(
      new Int16Array([10]),
      { id: "quoted", name: 'Name "quoted"', mask: new Uint8Array([1]) },
      1,
    );
    const csv = csvForStats([stats]);
    expect(csv).toContain('"Name ""quoted"""');
    expect(csv).toContain('"Standard deviation HU"');
  });
});
