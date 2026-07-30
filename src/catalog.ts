export type OrganDefinition = {
  file: string;
  name: string;
  shortName: string;
  colormap: string;
  color: string;
  aliases: string[];
};

export type WindowPreset = {
  id: string;
  name: string;
  center: number;
  width: number;
  shortcut: string;
};

export const ORGANS: OrganDefinition[] = [
  {
    file: "aorta.nii.gz",
    name: "Aorta",
    shortName: "Aorta",
    colormap: "red",
    color: "#ff6b6b",
    aliases: ["aorta"],
  },
  {
    file: "gall_bladder.nii.gz",
    name: "Gallbladder",
    shortName: "Gallbladder",
    colormap: "green",
    color: "#72d572",
    aliases: ["gall_bladder", "gallbladder", "gall bladder"],
  },
  {
    file: "kidney_left.nii.gz",
    name: "Left kidney",
    shortName: "Kidney L",
    colormap: "blue",
    color: "#7ca7ff",
    aliases: ["kidney_left", "left_kidney", "kidney l", "left kidney"],
  },
  {
    file: "kidney_right.nii.gz",
    name: "Right kidney",
    shortName: "Kidney R",
    colormap: "winter",
    color: "#4fd4dc",
    aliases: ["kidney_right", "right_kidney", "kidney r", "right kidney"],
  },
  {
    file: "liver.nii.gz",
    name: "Liver",
    shortName: "Liver",
    colormap: "warm",
    color: "#e8c64a",
    aliases: ["liver"],
  },
  {
    file: "pancreas.nii.gz",
    name: "Pancreas",
    shortName: "Pancreas",
    colormap: "plasma",
    color: "#ea66bf",
    aliases: ["pancreas"],
  },
  {
    file: "postcava.nii.gz",
    name: "Inferior vena cava",
    shortName: "IVC",
    colormap: "cool",
    color: "#55dfc5",
    aliases: ["postcava", "inferior_vena_cava", "vena_cava", "ivc"],
  },
  {
    file: "spleen.nii.gz",
    name: "Spleen",
    shortName: "Spleen",
    colormap: "violet",
    color: "#b68cff",
    aliases: ["spleen"],
  },
  {
    file: "stomach.nii.gz",
    name: "Stomach",
    shortName: "Stomach",
    colormap: "gold",
    color: "#f2bf52",
    aliases: ["stomach"],
  },
];

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: "soft", name: "Soft tissue", center: 40, width: 400, shortcut: "1" },
  { id: "abdomen", name: "Abdomen", center: 60, width: 400, shortcut: "2" },
  { id: "liver", name: "Liver", center: 70, width: 150, shortcut: "3" },
  { id: "lung", name: "Lung", center: -600, width: 1500, shortcut: "4" },
  { id: "bone", name: "Bone", center: 400, width: 1800, shortcut: "5" },
  { id: "brain", name: "Brain", center: 40, width: 80, shortcut: "6" },
  { id: "stroke", name: "Stroke", center: 32, width: 8, shortcut: "7" },
  { id: "blood", name: "Blood", center: 50, width: 100, shortcut: "8" },
  { id: "wide", name: "Full CT", center: 0, width: 2000, shortcut: "9" },
];

export function stripMedicalExtension(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.(nii(\.gz)?|dcm|dicom)$/i, "")
    .replace(/[-.]+/g, "_");
}

export function humanizeFilename(filename: string): string {
  return stripMedicalExtension(filename)
    .replace(/[_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function matchOrgan(filename: string): OrganDefinition | undefined {
  const normalized = stripMedicalExtension(filename).replace(/_/g, " ");
  return ORGANS.find((organ) =>
    organ.aliases.some((alias) =>
      normalized.includes(alias.replace(/_/g, " ")),
    ),
  );
}

export function colormapForIndex(index: number): string {
  return ORGANS[index % ORGANS.length]?.colormap ?? "warm";
}

export function colorForIndex(index: number): string {
  return ORGANS[index % ORGANS.length]?.color ?? "#7ca7ff";
}
