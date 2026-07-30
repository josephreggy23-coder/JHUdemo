import type { StructureStats } from "./statistics";

export type ReviewStatus = "not-reviewed" | "needs-attention" | "approved";

export type ReviewDraft = {
  status: ReviewStatus;
  notes: string;
  flaggedStructures: string[];
};

export type ReviewReport = {
  schemaVersion: 1;
  exportedAt: string;
  caseName: string;
  source: "sample" | "local-nifti" | "local-dicom";
  dimensions: number[];
  spacingMm: number[];
  review: ReviewDraft;
  structures: StructureStats[];
  privacy: "Processed locally in the browser";
};

export const EMPTY_REVIEW: ReviewDraft = {
  status: "not-reviewed",
  notes: "",
  flaggedStructures: [],
};

export function makeReviewReport(
  caseName: string,
  source: ReviewReport["source"],
  dimensions: number[],
  spacingMm: number[],
  review: ReviewDraft,
  structures: StructureStats[],
  now = new Date(),
): ReviewReport {
  return {
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    caseName,
    source,
    dimensions,
    spacingMm,
    review: {
      status: review.status,
      notes: review.notes.trim(),
      flaggedStructures: [...review.flaggedStructures].sort(),
    },
    structures,
    privacy: "Processed locally in the browser",
  };
}

export function safeCaseStorageKey(caseName: string): string {
  const normalized = caseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `bodymaps-review:${normalized || "untitled"}`;
}
