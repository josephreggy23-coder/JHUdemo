import { describe, expect, it } from "vitest";
import { classifyFiles, isSupportedMedicalFile } from "../src/files";

const medicalFile = (name: string, size: number, relativePath = ""): File => {
  const file = new File([new Uint8Array(size)], name);
  if (relativePath) {
    Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  }
  return file;
};

describe("case file classification", () => {
  it("finds the CT and masks regardless of order or filename case", () => {
    const liver = medicalFile("LIVER.NII.GZ", 20);
    const ct = medicalFile("CT.nii.gz", 100);
    const aorta = medicalFile("aorta.nii", 10);
    const result = classifyFiles([liver, aorta, ct]);

    expect(result.kind).toBe("nifti");
    expect(result.ct).toBe(ct);
    expect(result.structures.map((structure) => structure.name)).toEqual([
      "Liver",
      "Aorta",
    ]);
  });

  it("uses the largest NIfTI as a conservative fallback CT", () => {
    const large = medicalFile("primary-volume.nii.gz", 200);
    const small = medicalFile("labels.nii.gz", 20);
    expect(classifyFiles([small, large]).ct).toBe(large);
  });

  it("recognizes nested DICOM folders without relying on MIME types", () => {
    const dicom = medicalFile("IM0001.dcm", 300, "study/series/IM0001.dcm");
    const result = classifyFiles([dicom]);
    expect(result.kind).toBe("dicom");
    expect(result.dicomFiles).toEqual([dicom]);
  });

  it("safely reports unsupported files", () => {
    const notes = medicalFile("notes.txt", 10);
    const ct = medicalFile("ct.nii.gz", 100);
    const result = classifyFiles([notes, ct]);
    expect(result.ignored).toEqual([notes]);
    expect(isSupportedMedicalFile(notes)).toBe(false);
  });
});
