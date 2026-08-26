# rtichoke_viz agent operating rules

## Role and boundary

This repository owns shared canonical visualization contracts, TypeScript renderers, referential-integrity validation, ReportSpec rendering infrastructure, packaged JS/CSS/schema artifacts, and immutable visualization release preparation. It consumes already-computed statistical geometry; it does not own R or Python statistical calculations.

Do not implement or alter R/Python statistical formulas, censoring estimators, Aalen-Johansen logic, competing-risk calculations, or cutoff classification rules.

## Start from fresh state

Before modifying anything:

1. Inspect actual current `main`.
2. Inspect relevant open PRs and recent relevant merges.
3. Inspect tags and releases when relevant.
4. Check whether equivalent work already exists.

Do not work from stale assumptions.

## Scope and reuse

Make the smallest change required. Do not opportunistically redesign unrelated contracts, modify consumers, add statistics, expand ReportSpec product behavior, or introduce global UI state. Stop and report when a task requires a materially broader architectural decision.

Prefer existing generic v2 primitives, validation, horizon helpers, renderer infrastructure, and semantic metadata over duplication. Do not create a new time-dependent component spec when the existing canonical spec can represent the capability cleanly.

## Canonical identity and reference ownership

Preserve these distinct identity domains:

- `component.id`: report-local component identity;
- `evaluation.id`: semantic evaluation identity;
- `seriesId`: rendered geometry identity;
- `evaluation.id != seriesId`;
- `series.horizon`: component-local horizon/context metadata.

Do not introduce horizon IDs or place horizon inside `evaluation.id` merely to distinguish geometry. Do not infer semantic identity from numerical equality.

Use explicit reference ownership: `global`, `population`, or `population_horizon`. Numerically identical references belonging to distinct semantic owners remain distinct.

## Compatibility and ReportSpec

Preserve existing valid static v2 behavior and preserve v1 unless explicitly changed. Do not bump schema versions without a real compatibility reason.

Keep standalone component behavior and ReportSpec dispatch mechanically consistent. Do not automatically expand summary reports or introduce report-global selector coordination.

## Validation

Inspect the actual scripts and workflows before choosing commands. Run focused tests plus the complete relevant validation suite using the repository's current commands. Do not weaken tests or quality gates to obtain green CI.

## Pull-request ownership

For mutation tasks:

1. Implement the focused change.
2. Validate locally.
3. Open one focused PR.
4. Inspect GitHub Actions for the current PR head.
5. Inspect failed job logs and determine whether failures are caused by the PR.
6. Fix in-scope failures, push, and re-check until required checks are green or a genuine blocker requires user input.

Do not ask the user to check CI manually. Do not merge unless explicitly instructed. Escalate only when resolution requires a broader contract, architecture, compatibility, product, or infrastructure decision; do not escalate routine lint, formatting, test, fixture, packaging, or documentation failures.

## Immutable releases and consumers

Preserve this one-to-one identity:

`(package version, tag, exact source commit) -> one reproducible archive -> one checksum -> one MANIFEST/provenance identity -> publish once`

Do not move historical tags, overwrite historical release assets, or weaken checksum/MANIFEST verification. Release-preparation tasks stop at an unmerged PR unless publication is explicitly requested.

R and Python consumers must consume immutable `rtichoke_viz` releases. Never direct consumers to `rtichoke_viz/main` as a substitute for a release.

## Completion report

At the end of mutation work, report:

- starting `main`;
- branch and final head;
- files changed;
- semantic behavior changed;
- local validation;
- final GitHub Actions status;
- PR number, link, and state;
- anything deliberately deferred.
