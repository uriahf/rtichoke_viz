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
- Browser assets should compile to ordinary JavaScript/CSS that can later be vendored into CRAN and PyPI packages.
- Parity means the same semantics, mappings, ordering, scales, reference lines, labels, and interaction intent across renderers; not pixel-identical output.

## Initial scope

- ROC
- Calibration
- Deterministic fixtures
- Runtime schema validation
- Self-contained browser rendering
