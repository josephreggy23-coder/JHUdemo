import { describe, expect, it } from "vitest";
import {
  ORGANS,
  WINDOW_PRESETS,
  humanizeFilename,
  matchOrgan,
  stripMedicalExtension,
} from "../src/catalog";

describe("organ catalog", () => {
  it("contains nine unique structures", () => {
    expect(ORGANS).toHaveLength(9);
    expect(new Set(ORGANS.map((organ) => organ.file)).size).toBe(9);
    expect(new Set(ORGANS.map((organ) => organ.name)).size).toBe(9);
    expect(new Set(ORGANS.map((organ) => organ.color)).size).toBe(9);
  });

  it.each(ORGANS)("matches $file to $name", (organ) => {
    expect(matchOrgan(organ.file)?.name).toBe(organ.name);
  });

  it("distinguishes left and right kidneys", () => {
    expect(matchOrgan("patient/kidney_left.nii.gz")?.name).toBe("Left kidney");
    expect(matchOrgan("patient/right_kidney.NII.GZ")?.name).toBe(
      "Right kidney",
    );
  });

  it("recognizes clinical aliases", () => {
    expect(matchOrgan("inferior_vena_cava.nii.gz")?.shortName).toBe("IVC");
    expect(matchOrgan("gallbladder.nii")?.name).toBe("Gallbladder");
  });

  it("formats arbitrary filenames without leaking extensions", () => {
    expect(stripMedicalExtension("new-lesion.NII.GZ")).toBe("new_lesion");
    expect(humanizeFilename("new-lesion.nii.gz")).toBe("New Lesion");
  });
});

describe("window presets", () => {
  it("provides nine unique keyboard presets", () => {
    expect(WINDOW_PRESETS).toHaveLength(9);
    expect(new Set(WINDOW_PRESETS.map((preset) => preset.shortcut)).size).toBe(
      9,
    );
    expect(WINDOW_PRESETS.every((preset) => preset.width > 0)).toBe(true);
  });

  it("has correct soft-tissue, lung and bone windows", () => {
    const bounds = (id: string) => {
      const preset = WINDOW_PRESETS.find((item) => item.id === id);
      if (!preset) throw new Error(`Missing preset ${id}`);
      return [
        preset.center - preset.width / 2,
        preset.center + preset.width / 2,
      ];
    };
    expect(bounds("soft")).toEqual([-160, 240]);
    expect(bounds("lung")).toEqual([-1350, 150]);
    expect(bounds("bone")).toEqual([-500, 1300]);
  });
});
