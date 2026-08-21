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

## Current proof of concept

The initial contract covers ROC and calibration specifications. Deterministic JSON fixtures drive both the tests and the browser demo.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run build:demo
```

`npm run build` creates the distributable browser assets under `dist/`. `npm run build:demo` also exports the canonical JSON Schema to `schemas/rtichoke-viz.schema.json` and creates a self-contained demo site under `site/`. After changes reach `main`, GitHub Pages deploys that generated demo.

## Distribution

`rtichoke_viz` GitHub Releases are the language-neutral distribution boundary for the compiled browser bundle. A `vX.Y.Z` tag matching the version in `package.json` publishes `rtichoke-viz-X.Y.Z.tar.gz` plus its SHA-256 checksum. The archive contains the compiled JavaScript, CSS, exported JSON Schema, and a manifest recording the version and source commit.

R and Python consumers should vendor an exact released archive during package development and record its version/checksum. Package installation itself should not require Node, GitHub, or network access.

## Initial scope

- ROC
- Calibration
- Deterministic fixtures
- Runtime schema validation
- Exported JSON Schema
- Self-contained browser rendering
- Versioned browser bundle releases
- CI-built demo artifact and GitHub Pages deployment
