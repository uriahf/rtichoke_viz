import { copyFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("site", { recursive: true });
await build({
  entryPoints: ["src/demo.ts"],
  bundle: true,
  format: "esm",
  outfile: "site/demo.js",
});
await copyFile("demo/index.html", "site/index.html");
await copyFile("schemas/rtichoke-viz.schema.json", "site/rtichoke-viz.schema.json");
