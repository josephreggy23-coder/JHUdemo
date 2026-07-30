/// <reference lib="webworker" />

import {
  computeStructureStats,
  type NumericArray,
  type StructureStats,
} from "./statistics";

type SerializedArray = {
  kind:
    | "Float32Array"
    | "Float64Array"
    | "Int32Array"
    | "Uint32Array"
    | "Int16Array"
    | "Uint16Array"
    | "Uint8Array";
  buffer: ArrayBuffer;
};

type WorkerMessage = {
  ct: SerializedArray;
  masks: Array<{ id: string; name: string; data: SerializedArray }>;
  voxelVolumeMm3: number;
  slope: number;
  intercept: number;
};

function restore(data: SerializedArray): NumericArray {
  switch (data.kind) {
    case "Float32Array":
      return new Float32Array(data.buffer);
    case "Float64Array":
      return new Float64Array(data.buffer);
    case "Int32Array":
      return new Int32Array(data.buffer);
    case "Uint32Array":
      return new Uint32Array(data.buffer);
    case "Int16Array":
      return new Int16Array(data.buffer);
    case "Uint16Array":
      return new Uint16Array(data.buffer);
    case "Uint8Array":
      return new Uint8Array(data.buffer);
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
  const payload = event.data;
  const ct = restore(payload.ct);
  const results: StructureStats[] = payload.masks.map((mask) =>
    computeStructureStats(
      ct,
      { id: mask.id, name: mask.name, mask: restore(mask.data) },
      payload.voxelVolumeMm3,
      payload.slope,
      payload.intercept,
    ),
  );
  self.postMessage(results);
});
