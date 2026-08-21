import { mkdir, writeFile } from "node:fs/promises";
import { RtichokeChartSpecSchema } from "../src/spec/chart.js";
import { RtichokeChartSpecV2Schema } from "../src/spec/v2/chart.js";

await mkdir("schemas", { recursive: true });
await writeFile(
  "schemas/rtichoke-viz.schema.json",
  `${JSON.stringify(RtichokeChartSpecSchema, null, 2)}\n`,
  "utf8",
);
await writeFile(
  "schemas/rtichoke-viz-v2.schema.json",
  `${JSON.stringify(RtichokeChartSpecV2Schema, null, 2)}\n`,
  "utf8",
);
