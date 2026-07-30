import { humanizeFilename, matchOrgan } from "./catalog";

export type ClassifiedFile = {
  file: File;
  name: string;
  isKnownOrgan: boolean;
};

export type ClassifiedCase = {
  kind: "nifti" | "dicom";
  ct: File | null;
  structures: ClassifiedFile[];
  dicomFiles: File[];
  ignored: File[];
};

const NIFTI_PATTERN = /\.nii(\.gz)?$/i;
const DICOM_PATTERN = /\.(dcm|dicom)$/i;

function looksLikeCt(filename: string): boolean {
  const stem = filename.toLowerCase().replace(/\.nii(\.gz)?$/i, "");
  return (
    /(^|[/\\])(ct|ct_scan|image|volume|scan)$/.test(stem) ||
    stem.endsWith("/ct") ||
    stem.endsWith("\\ct")
  );
}

export function classifyFiles(input: Iterable<File>): ClassifiedCase {
  const files = Array.from(input);
  const nifti = files.filter((file) => NIFTI_PATTERN.test(file.name));
  const dicomFiles = files.filter(
    (file) =>
      DICOM_PATTERN.test(file.name) ||
      (!file.name.includes(".") && file.size > 128),
  );
  const ignored = files.filter(
    (file) => !nifti.includes(file) && !dicomFiles.includes(file),
  );

  if (nifti.length === 0 && dicomFiles.length > 0) {
    return { kind: "dicom", ct: null, structures: [], dicomFiles, ignored };
  }

  const explicitCt = nifti.find((file) => looksLikeCt(file.name));
  const ct =
    explicitCt ??
    [...nifti].sort((left, right) => right.size - left.size)[0] ??
    null;

  const structures = nifti
    .filter((file) => file !== ct)
    .map((file) => {
      const organ = matchOrgan(file.name);
      return {
        file,
        name: organ?.name ?? humanizeFilename(file.name),
        isKnownOrgan: Boolean(organ),
      };
    });

  return {
    kind: "nifti",
    ct,
    structures,
    dicomFiles: [],
    ignored,
  };
}

export function isSupportedMedicalFile(file: File): boolean {
  return (
    NIFTI_PATTERN.test(file.name) ||
    DICOM_PATTERN.test(file.name) ||
    (!file.name.includes(".") && file.size > 128)
  );
}
