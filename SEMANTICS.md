# Canonical visualization semantics

This document defines the semantic vocabulary that `rtichoke_viz` should use as
the shared visualization layer for `rtichoke` and `rtichoke_python`.

It is a contract for future schema design. It does not change the current JSON
schema, browser renderers, adapters, statistical calculations, or public R/Python
APIs.

## Architecture boundary

`rtichoke_viz` owns the language-neutral visualization contract and browser
rendering. Statistical calculations remain in `rtichoke` and
`rtichoke_python`.

The visualization contract should therefore receive already-computed chart data,
semantic identity, and reference-line ownership. It should not infer statistical
quantities such as prevalence, event risk, calibration estimates, or reference
values from plotted data.

## Core concepts

### Model

A **model** is the prediction rule, or named set of predictions, that produced
the values being evaluated.

Model identity answers **what produced the predictions**. It does not identify
the subjects or outcomes used to evaluate them.

Model identity may be unavailable from a compatibility input. When it is not
known, the visualization layer must preserve that uncertainty rather than infer
a model name from a generic grouping label.

### Population

A **population** is the set of subjects and observed outcomes against which a
model is evaluated.

Population-level quantities include prevalence or event risk, sample size,
censoring and competing-event experience, and other properties of the
evaluation data.

Two populations remain distinct even when one or more population-level
quantities happen to have equal numerical values.

### Evaluation

An **evaluation** is one model evaluated in one population.

Conceptually, evaluation identity is therefore

`model × population`.

Some current R/Python compatibility paths cannot separately identify both
components. In those cases, the adapter may know only an evaluation/population
label and an unknown model. The canonical contract should represent what is
actually known rather than manufacture the missing identity.

### Evaluation context

The **evaluation context** contains conditions that qualify an evaluation
without changing the underlying model or population identity.

For time-dependent outputs, the fixed time horizon is part of this context.
Other future visualization-relevant qualifiers may also belong here when they
change the interpretation of a plotted series or reference.

### Fixed time horizon

A **fixed time horizon** is the time point at which a time-dependent evaluation
is defined.

The same model-population evaluation at two horizons represents two distinct
horizon-specific plotted series where the output is a curve. Population-level
reference values may also differ by horizon.

### Plotted series

A **plotted series** is an actual model-derived curve or set of points drawn for
one evaluation in one applicable context.

For ordinary binary outputs, a plotted series is typically identified by

`evaluation`.

For time-dependent outputs, it is typically identified by

`evaluation × fixed time horizon`.

A plotted series is not a reference line. Renderer bookkeeping traces, cutoff
markers, hover helpers, or animation traces are also not additional semantic
series.

### Display grouping

A **display grouping** determines how plotted series are presented through
labels, colors, legends, or grouping aesthetics.

Display grouping is derived from semantic identity and presentation intent; it
is not itself the source of semantic truth. Depending on the input scenario, a
legend entry may represent a model, a population, an evaluation, or an
applicable context label.

Therefore equal colors do not imply equal evaluation identity, and separate
colors do not necessarily imply different populations.

## Reference-line ownership

A reference line is a benchmark, not a model evaluation. Its semantic identity
should be determined by the context that owns its value.

The visualization contract should distinguish at least these scopes:

- **Global**: independent of model, population, and horizon for the applicable
  output.
- **Population-specific**: determined by one evaluation population and shared by
  all models evaluated in that population.
- **Population-and-horizon-specific**: determined by one population at one fixed
  time horizon and shared by all models evaluated in that population at that
  horizon.

Two references may have equal numerical values without becoming the same
semantic reference. Distinct populations with equal prevalence or event risk
retain distinct ownership when the benchmark is population-dependent.

Examples from the finalized R/Python semantics include:

- ROC random/identity diagonal: global;
- calibration perfect-calibration identity line: global;
- precision-recall random baseline: population-specific;
- gains/lift perfect-model references: population-specific;
- decision-curve prevalence-dependent references: population-specific;
- time-dependent population-derived references: population-and-horizon-specific.

The statistical packages compute the values. `rtichoke_viz` should render the
ownership already encoded in the canonical spec.

## Compatibility terminology

### `reference_group`

`reference_group` is a source compatibility and grouping concept used by
existing consumer implementations. It is **not** a canonical domain concept in
`rtichoke_viz`.

Depending on the source path, `reference_group` may correspond to a model, a
population, a generic evaluation label, or another compatibility grouping.
Adapters must therefore interpret it using semantic context supplied by the
consumer rather than assume

`reference_group == model`

or

`reference_group == population`.

The canonical visualization schema should not promote `reference_group` into a
permanent semantic identity field.

## Implications for the current v1 proof

The current ROC and calibration schema was sufficient to prove the shared
architecture, but some fields are currently overloaded:

- `model` is required and is also used as the renderer's series/color/legend key;
- `population` and `horizon` can be present but do not currently drive semantic
  grouping;
- references encode geometry but not semantic ownership;
- calibration distribution rows are grouped through `model` even though their
  ownership belongs to an evaluation/population context;
- source adapters can currently map `reference_group` directly into `model`.

These are proof-of-concept limitations, not target semantics.

A later schema revision should make evaluation identity, context, display
grouping, and reference ownership explicit before new chart types with
population-dependent references are added.

## Migration principles for the next schema step

The next schema design should follow these rules:

1. Preserve separate model and population identity when they are known.
2. Permit model identity to be unknown when compatibility inputs do not encode
   it separately.
3. Represent evaluation identity explicitly enough that a plotted series does
   not depend on a generic display label.
4. Treat horizon as evaluation context, not as a substitute for population
   identity.
5. Encode reference ownership independently from numerical reference values.
6. Derive labels, legends, colors, and grouping from explicit semantic/display
   metadata rather than from a field named `model` by convention.
7. Keep adapter-specific compatibility terminology at the adapter boundary.
8. Keep all statistical calculations and reference-value derivation in the R
   and Python packages.

The exact JSON normalization strategy—such as nested evaluation objects versus
flattened row metadata—is deliberately left for the subsequent schema-design
PR.

## Scope

This document does not change:

- the current `1.0` JSON schema;
- existing ROC or calibration fixtures;
- adapters or renderer behavior;
- browser bundle versioning;
- statistical calculations;
- public `rtichoke` or `rtichoke_python` APIs;
- current chart output semantics.

Its purpose is to lock the domain vocabulary before revising the visualization
schema or adding another chart type.
