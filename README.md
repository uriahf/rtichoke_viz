# rtichoke_viz

Shared TypeScript visualization contracts and browser renderers for the `rtichoke` R and Python ecosystems.

This repository is an early proof of concept. The first goal is to define a small, language-independent chart specification for ROC and calibration plots, validate it in TypeScript, and render it in the browser without moving statistical calculations out of the R or Python packages.

## Architecture

```text
rtichoke R ---------\
                     > canonical JSON spec -> rtichoke_viz -> browser renderer
rtichoke Python ----/

R      -> same spec -> ggplot2 / Plotly
Python -> same spec -> Plotly
```

## Principles

- Statistical calculations stay in `rtichoke` and `rtichoke_python`.
- JSON is the interchange format between languages.
- TypeScript defines and validates the visualization contract.
- Browser assets compile to ordinary JavaScript/CSS that can be vendored into CRAN and PyPI packages.
- Parity means the same semantics, mappings, ordering, scales, reference lines, labels, and interaction intent across renderers; not pixel-identical output.
- Canonical model, population, evaluation, series, display-grouping, horizon, and reference-ownership semantics are defined in [`SEMANTICS.md`](SEMANTICS.md).

## Current proof of concept

The initial v1 contract covers ROC and calibration specifications. Deterministic JSON fixtures drive both the tests and the browser demo.

The v2 schema is the semantic successor used by the current browser, R, and Python consumer proofs for ROC, calibration, precision-recall, and gains. It represents evaluations separately from plotted series, permits unknown model identity, makes display grouping explicit, and encodes global/population/population-and-horizon reference ownership. Browser renderer options such as dimensions and palettes remain presentation metadata outside the canonical statistical specification.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run build:demo
```

`npm run build` creates the distributable browser assets under `dist/`. `npm run build:demo` also exports the JSON Schemas to `schemas/rtichoke-viz.schema.json` (v1) and `schemas/rtichoke-viz-v2.schema.json` (v2), and creates a self-contained demo site under `site/`. After changes reach `main`, GitHub Pages deploys that generated demo.

### Browser theme options

All v2 renderers share the exported `RTICHOKE_BROWSER_THEME`. Presentation overrides stay outside the canonical v2 spec:

```ts
renderRocV2(spec, {
  width: 720,
  height: 480,
  colors: ["#1b9e77", "#d95f02"],
  theme: {
    line: { width: 3 },
    marker: { radius: 6 },
    reference: { dash: "2,3" },
    tip: { digits: 2 },
  },
});
```

Display groups receive colors in their first explicit series order. A single display group remains black and has no legend, preserving the existing renderer behavior.

## Distribution

`rtichoke_viz` GitHub Releases are the language-neutral distribution boundary for the compiled browser bundle. A `vX.Y.Z` tag matching the version in `package.json` publishes `rtichoke-viz-X.Y.Z.tar.gz` plus its SHA-256 checksum. The archive contains the compiled JavaScript, CSS, JSON Schema, and a manifest recording the version and source commit.

R and Python consumers should vendor an exact released archive during package development and record its version/checksum. Package installation itself should not require Node, GitHub, or network access.

## Initial scope

- ROC
- Calibration
- Precision-recall
- Gains
- Deterministic fixtures
- Runtime schema validation
- Exported JSON Schema
- Self-contained browser rendering
- Versioned browser bundle releases
- CI-built demo artifact and GitHub Pages deployment

