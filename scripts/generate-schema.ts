import { mkdir, writeFile } from "node:fs/promises";
import { RtichokeChartSpecSchema } from "../src/spec/chart.js";

await mkdir("schemas", { recursive: true });
await writeFile(
  "schemas/rtichoke-viz.schema.json",
  `${JSON.stringify(RtichokeChartSpecSchema, null, 2)}\n`,
  "utf8",
);
