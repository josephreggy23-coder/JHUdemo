import { describe, expect, it } from "vitest";
import { makeReviewReport, safeCaseStorageKey } from "../src/review";

describe("quality-control reports", () => {
  it("normalizes reviewer content into a deterministic report", () => {
    const report = makeReviewReport(
      "Case 001",
      "local-nifti",
      [10, 20, 30],
      [0.8, 0.8, 2.5],
      {
        status: "needs-attention",
        notes: "  Check liver boundary.  ",
        flaggedStructures: ["spleen", "aorta"],
      },
      [],
      new Date("2026-07-30T12:00:00.000Z"),
    );
    expect(report.exportedAt).toBe("2026-07-30T12:00:00.000Z");
    expect(report.review.notes).toBe("Check liver boundary.");
    expect(report.review.flaggedStructures).toEqual(["aorta", "spleen"]);
    expect(report.privacy).toBe("Processed locally in the browser");
  });

  it("creates stable, scoped storage keys", () => {
    expect(safeCaseStorageKey("  Patient / Case #42 ")).toBe(
      "bodymaps-review:patient-case-42",
    );
    expect(safeCaseStorageKey("")).toBe("bodymaps-review:untitled");
  });
});
