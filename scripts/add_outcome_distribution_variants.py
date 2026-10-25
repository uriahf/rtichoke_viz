import json
import os

HEURISTIC_PAIRS = [
    "excluded:excluded",
    "excluded:adjusted_as_censored",
    "excluded:adjusted_as_negative",
    "excluded:adjusted_as_composite",
    "adjusted:excluded",
    "adjusted:adjusted_as_censored",
    "adjusted:adjusted_as_negative",
    "adjusted:adjusted_as_composite",
]

def generate_variants_for_fixture(filepath):
    with open(filepath, "r") as f:
        spec = json.load(f)

    evaluations = spec["evaluations"]
    state_dists = spec["stateDistributions"]

    # Group fixed_time_horizon state distributions by evaluationId and horizon
    eval_horizon_counts = {}
    for dist in state_dists:
        if dist.get("estimateOrigin") != "fixed_time_horizon":
            continue
        e_id = dist["evaluationId"]
        h = dist["horizon"]

        pos_cnt = 0
        comp_cnt = 0
        neg_cnt = 0
        cens_cnt = 0

        for s in dist["states"]:
            s_id = s["stateId"]
            cnt = s.get("count", 0)
            if s_id in ["real_positive", "primary", "target_event"]:
                pos_cnt += cnt
            elif s_id in ["real_competing", "competing", "competing_outcome"]:
                comp_cnt += cnt
            elif s_id in ["real_negative", "event_free", "no_target_event"]:
                neg_cnt += cnt
            elif s_id in ["real_censored", "censored", "unknown"]:
                cens_cnt += cnt

        if e_id not in eval_horizon_counts:
            eval_horizon_counts[e_id] = {}
        eval_horizon_counts[e_id][h] = {
            "pos": pos_cnt,
            "comp": comp_cnt,
            "neg": neg_cnt,
            "cens": cens_cnt,
        }

    # Infer sample size N per evaluation from horizon 0 or total sum
    eval_sample_size = {}
    for e_id, h_map in eval_horizon_counts.items():
        first_h = sorted(h_map.keys())[0]
        c = h_map[first_h]
        total_n = c["pos"] + c["comp"] + c["neg"] + c["cens"]
        eval_sample_size[e_id] = total_n

    variants = {}

    for pair in HEURISTIC_PAIRS:
        cens_h, comp_h = pair.split(":")
        var_state_dists = []
        var_exclusions = []

        for ev in evaluations:
            e_id = ev["id"]
            N = eval_sample_size[e_id]
            h_map = eval_horizon_counts[e_id]

            excluded_counts = []

            for h in sorted(h_map.keys()):
                c = h_map[h]
                n_pos = c["pos"]
                n_comp = c["comp"]
                n_cens = c["cens"]

                cens_ex = n_cens if cens_h == "excluded" else 0
                comp_ex = n_comp if comp_h == "excluded" else 0

                excluded_counts.append({
                    "horizon": h,
                    "censoredExcludedCount": cens_ex,
                    "competingExcludedCount": comp_ex,
                })

                # Compute probability estimates for this variant
                retained = N - cens_ex - comp_ex
                if retained <= 0:
                    retained = 1

                estimator_name = "kaplan_meier" if "excluded" in pair else "aalen_johansen"

                states = []

                if comp_h == "adjusted_as_negative":
                    # 3 states: primary, competing, event_free
                    p_pos = n_pos / retained
                    p_comp = n_comp / retained
                    p_free = max(0.0, 1.0 - p_pos - p_comp)
                    states = [
                        {"stateId": "primary", "label": "Target event", "estimate": round(p_pos, 6)},
                        {"stateId": "competing", "label": "Competing outcome", "estimate": round(p_comp, 6)},
                        {"stateId": "event_free", "label": "No target event", "estimate": round(p_free, 6)},
                    ]
                elif comp_h == "adjusted_as_composite":
                    # 2 states: composite, event_free
                    p_comp_event = (n_pos + n_comp) / retained
                    p_free = max(0.0, 1.0 - p_comp_event)
                    states = [
                        {"stateId": "composite", "label": "Composite Event", "estimate": round(p_comp_event, 6)},
                        {"stateId": "event_free", "label": "No target event", "estimate": round(p_free, 6)},
                    ]
                else:
                    # 2 states: primary, event_free
                    p_pos = n_pos / retained
                    p_free = max(0.0, 1.0 - p_pos)
                    states = [
                        {"stateId": "primary", "label": "Target event", "estimate": round(p_pos, 6)},
                        {"stateId": "event_free", "label": "No target event", "estimate": round(p_free, 6)},
                    ]

                var_state_dists.append({
                    "evaluationId": e_id,
                    "horizon": h,
                    "estimator": estimator_name,
                    "estimateOrigin": "fixed_time_horizon",
                    "censoringHeuristic": cens_h,
                    "competingHeuristic": comp_h,
                    "states": states,
                })

            var_exclusions.append({
                "evaluationId": e_id,
                "originalSampleSize": N,
                "excludedCounts": excluded_counts,
            })

        variants[pair] = {
            "status": "available",
            "stateDistributions": var_state_dists,
            "exclusions": var_exclusions,
        }

    spec["variants"] = variants

    with open(filepath, "w") as f:
        json.dump(spec, f, indent=2)

    print(f"Successfully enriched {filepath} with 8 heuristic variants!")

if __name__ == "__main__":
    for path in [
        "fixtures/v2/outcome-distribution.json",
        "fixtures/v2/outcome-distribution-large.json",
        "fixtures/v2/outcome-distribution-populations.json",
    ]:
        generate_variants_for_fixture(path)
