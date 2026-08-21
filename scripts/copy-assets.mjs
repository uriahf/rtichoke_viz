import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await copyFile("src/rtichoke-viz.css", "dist/rtichoke-viz.css");
