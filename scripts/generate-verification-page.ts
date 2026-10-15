import fs from "node:fs";
import path from "node:path";
import JSDOM from "jsdom";
import { renderOutcomeDistribution } from "../src/render/outcome-distribution.js";

const jsdom = new JSDOM.JSDOM("<!DOCTYPE html><html><body></body></html>");
global.window = jsdom.window as any;
global.document = jsdom.window.document;
global.HTMLElement = jsdom.window.HTMLElement;
global.Element = jsdom.window.Element;
global.Node = jsdom.window.Node;

const rawSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step (100% Stacked Bars - Raw Counts)",
  evaluations: [{ id: "eval-1", population: "test-cohort" }],
  stateDistributions: [
    {
      evaluationId: "eval-1",
      horizon: 1,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", count: 80 },
        { stateId: "relapse", count: 15 },
        { stateId: "death", count: 5 }
      ]
    },
    {
      evaluationId: "eval-1",
      horizon: 2,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", count: 65 },
        { stateId: "relapse", count: 25 },
        { stateId: "death", count: 10 }
      ]
    },
    {
      evaluationId: "eval-1",
      horizon: 3,
      estimator: "raw",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "remission", count: 50 },
        { stateId: "relapse", count: 30 },
        { stateId: "death", count: 20 }
      ]
    }
  ]
};

const ordinalSpec = {
  schemaVersion: "2.0",
  type: "outcome_distribution",
  title: "Observed Step (Ordinal True Blue Palette - 5 Levels)",
  stateScale: "ordinal",
  evaluations: [{ id: "eval-1", population: "test-cohort" }],
  stateDistributions: [
    {
      evaluationId: "eval-1",
      horizon: 1,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "stage_1", label: "Stage I", estimate: 0.40 },
        { stateId: "stage_2", label: "Stage II", estimate: 0.30 },
        { stateId: "stage_3", label: "Stage III", estimate: 0.15 },
        { stateId: "stage_4", label: "Stage IV", estimate: 0.10 },
        { stateId: "stage_5", label: "Stage V", estimate: 0.05 }
      ]
    },
    {
      evaluationId: "eval-1",
      horizon: 2,
      estimator: "aalen_johansen",
      estimateOrigin: "observed_step",
      states: [
        { stateId: "stage_1", label: "Stage I", estimate: 0.25 },
        { stateId: "stage_2", label: "Stage II", estimate: 0.30 },
        { stateId: "stage_3", label: "Stage III", estimate: 0.25 },
        { stateId: "stage_4", label: "Stage IV", estimate: 0.12 },
        { stateId: "stage_5", label: "Stage V", estimate: 0.08 }
      ]
    }
  ]
};

const rawEl = renderOutcomeDistribution(rawSpec as any);
const ordEl = renderOutcomeDistribution(ordinalSpec as any);

const cssPath = path.resolve("src/rtichoke-viz.css");
const cssContent = fs.readFileSync(cssPath, "utf-8");

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, Helvetica, sans-serif; background: #ffffff; padding: 20px; color: #1f2937; }
    ${cssContent}
    .preview-container { margin-bottom: 40px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #fff; }
  </style>
</head>
<body>
  <div class="preview-container">
    ${rawEl.outerHTML}
  </div>
  <div class="preview-container">
    ${ordEl.outerHTML}
  </div>
</body>
</html>`;

fs.mkdirSync("/home/jules/verification", { recursive: true });
fs.writeFileSync("/home/jules/verification/preview.html", html);
