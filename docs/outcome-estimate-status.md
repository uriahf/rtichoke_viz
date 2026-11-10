# Outcome Distribution estimate status

`StateDistribution.estimateStatus` is an optional additive field in schema v2.0.
It applies to one semantic evaluation and horizon, including when the row belongs
to a precomputed heuristic variant. Variant availability is independent: an
available variant can include undefined horizons.

| Value | Producer payload | Display |
| --- | --- | --- |
| `defined` | Complete finite probabilities summing to one for estimated distributions; existing raw counts remain supported | Supplied probabilities/counts |
| `undefined_empty_population` | Every state has explicit `estimate: null`; no numeric count, mass or interval bounds; matching evaluation/horizon exclusion counts sum to original sample size | Unavailable; no outcome bar or zero-percent readout; exclusion counts and original-size percentages remain visible |
| `beyond_support_plateau` | Complete finite probabilities summing to one, preserving the estimator's supplied plateau | Probabilities remain visible with a support notice, chart annotation and tooltip |

For example, an empty retained cohort at horizon 3 may contain:

```json
{
  "evaluationId": "cohort",
  "horizon": 3,
  "estimator": "kaplan_meier",
  "estimateOrigin": "fixed_time_horizon",
  "estimateStatus": "undefined_empty_population",
  "states": [
    { "stateId": "primary", "estimate": null },
    { "stateId": "event_free", "estimate": null }
  ]
}
```

Its corresponding exclusions entry must include `evaluationId: "cohort"`, the
positive `originalSampleSize`, and a horizon-3 record whose two exclusion counts
sum to that sample size. All states and all horizons remain in the payload.
The renderer does not infer censoring rules, refit estimators, or infer support
from numeric values. Producers must supply the correct status.

The field is optional for compatibility. Existing numeric raw/estimated payloads
retain their semantics. Legacy rows with no supplied estimate, count or mass in
any state display a generic unavailable notice, rather than zero probabilities.
No exclusion reason is inferred for those legacy rows. Undefined trajectory rows
break the drawn area and internal boundaries instead of connecting across a gap.

Supplied horizon zero is an ordinary horizon: its probabilities and exclusions
are displayed as supplied. A synthetic slider origin is used only when zero was
not supplied; it does not overwrite a supplied zero-time estimate.

Terminal-event tooltips distinguish raw observed accounting, KM estimates, and
AJ estimates. Adjusted probabilities are not labeled as raw observed status.
The notice and readout update locally when the horizon, evaluation or report
heuristic selection changes. Other reports on the page remain independent.

`fixtures/v2/outcome-distribution-estimate-status.json` covers all eight pairs
for an all-censored cohort (times 0 and 2, matching the #441 reference case) and
a separate complete-event cohort (both target events at time 1), at horizons
0, 1 and 3. It is a display/contract fixture, not an estimator implementation.

## Adoption

This is a source change only. Historical release archives and checksums remain
unchanged. After review and a separately published immutable renderer release,
R and Python can vendor that release. Python's internal producer added in #442
can then map its prepared `status` to `estimateStatus` and serialize complete
variants without rejecting empty/support-limited rows. Consumer adoption and
report wiring are separate changes.
