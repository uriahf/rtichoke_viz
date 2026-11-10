import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

// Exercise the built production bundle in a real browser, independently of jsdom.
const html = `<!doctype html><html><head><link rel="stylesheet" href="/dist/rtichoke-viz.css"></head>
<body><div id="first"></div><div id="second"></div><pre id="result">RUNNING</pre>
<script type="module">
import { renderReport, renderOutcomeDistribution } from "/dist/rtichoke-viz.js";
try {
  const spec = await (await fetch("/fixtures/v2/outcome-distribution-estimate-status.json")).json();
  const report = {schemaVersion:"1.1", type:"report", heuristics:{active:"excluded:excluded",available:Object.keys(spec.variants)},
    sections:[{id:"outcome",title:"Outcome",items:[{type:"component",id:"od",spec}]}]};
  const first = document.querySelector("#first"), second = document.querySelector("#second");
  first.append(renderReport(report)); second.append(renderReport(report));
  const readout = root => root.querySelector(".rtichoke-outcome-distribution__readout").textContent;
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const choose = (root, selector) => {
    const radio = root.querySelector(selector);
    radio.checked = true; radio.dispatchEvent(new Event("change",{bubbles:true}));
  };
  check(readout(first).includes("no subjects remain"), "empty cohort not unavailable");
  check(readout(first).includes("2 / 2 (100.0%)"), "original-size exclusions lost");
  check(first.querySelectorAll(".rtichoke-outcome-distribution__estimate-status").length === 1, "missing status");
  const outcomeRows = first.querySelectorAll("tbody tr");
  check(!outcomeRows[0].querySelector(".rtichoke-performance-table__bar"), "empty probability has a bar");
  for (const c of ["adjusted","excluded"]) {
    choose(first, 'input[name$="-censoring"][value="'+c+'"]');
    for (const k of ["excluded","adjusted_as_censored","adjusted_as_negative","adjusted_as_composite"]) {
      choose(first, 'input[name$="-competing"][value="'+k+'"]');
      check(readout(first).includes("Time = 3.000"), "heuristic switch lost horizon");
      check(readout(first).includes(c === "excluded" ? "no subjects remain" : "estimator plateaus"), "wrong status after heuristic switch");
    }
  }
  const slider = first.querySelector('input[type="range"]');
  slider.value = "1"; slider.dispatchEvent(new Event("input",{bubbles:true}));
  check(!readout(first).includes("Unavailable"), "valid horizon incorrectly unavailable");
  check(readout(first).includes("1 / 2 (50.0%)"), "horizon exclusions incorrect");
  choose(first, 'input[value="complete"]');
  check(readout(first).includes("100.0%"), "population switch lost probability");
  check(readout(second).includes("no subjects remain"), "report state leaked");
  // A standalone chart has the same status behavior as ReportSpec dispatch.
  const variant = spec.variants["adjusted:adjusted_as_negative"];
  const standalone = renderOutcomeDistribution({...spec,stateDistributions:variant.stateDistributions,exclusions:variant.exclusions});
  document.body.append(standalone);
  check(readout(standalone).includes("estimator plateaus"), "standalone plateau notice missing");
  const titles = [...standalone.querySelectorAll("svg title")].map(t=>t.textContent).join(" ");
  check(titles.includes("Aalen–Johansen estimate"), "adjusted tooltip accounting incorrect");
  check(!titles.includes("Raw observed status"), "adjusted tooltip says raw");
  const ids = [...document.querySelectorAll("[id]")].map(e=>e.id);
  check(new Set(ids).size === ids.length, "duplicate DOM IDs");
  document.querySelector("#result").textContent = "PASS: outcome estimate status browser acceptance";
} catch (error) { document.querySelector("#result").textContent = "FAIL: " + error.stack; }
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const path = request.url === "/" ? null : new URL(request.url, "http://localhost").pathname.slice(1);
    if (path && !path.startsWith("dist/") && !path.startsWith("fixtures/")) {
      response.writeHead(404).end(); return;
    }
    const type = path?.endsWith(".js") ? "text/javascript" : path?.endsWith(".css") ? "text/css" : path?.endsWith(".json") ? "application/json" : "text/html";
    response.setHeader("Content-Type", type);
    response.end(path ? await readFile(path) : html);
  } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const browser = process.env.CHROME_BIN || "google-chrome";
  const url = `http://127.0.0.1:${server.address().port}/`;
  const child = spawn(browser, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=1200,900", "--virtual-time-budget=10000", "--dump-dom", url]);
  let stdout = "", stderr = "";
  child.stdout.on("data", d => stdout += d);
  child.stderr.on("data", d => stderr += d);
  const timeout = setTimeout(() => child.kill("SIGKILL"), 60000);
  try {
    const exit = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    assert.equal(exit, 0, stderr);
    assert.ok(stdout.includes('<pre id="result">PASS: outcome estimate status browser acceptance</pre>'), stdout);
    console.log("PASS: outcome estimate status browser acceptance");
  } finally { clearTimeout(timeout); }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
