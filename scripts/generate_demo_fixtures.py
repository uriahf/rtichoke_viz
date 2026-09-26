import json
import math
from pathlib import Path

out_dir = Path("fixtures/v2/demo")
out_dir.mkdir(parents=True, exist_ok=True)

PREVALENCE = 0.25

def round_num(val, digits=4):
    return round(float(val), digits)

# -----------------------------------------------------------------------------
# 1. Calibration (Single & Multi-Population)
# -----------------------------------------------------------------------------
def generate_calibration_single():
    midpoints = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
    counts = [40, 80, 150, 200, 210, 150, 90, 50, 20, 10] # sum = 1000

    # Realistic slightly under-calibrated in high risk, over-calibrated in low risk
    # e.g., observed = predicted * 0.9 + 0.02
    data = []
    distribution = []

    for mp, count in zip(midpoints, counts):
        obs = round_num(mp * 0.92 + 0.01)
        tot = count
        ev = math.floor(obs * tot + 0.5)
        data.append({
            "seriesId": "series-model-a",
            "predicted": mp,
            "observed": obs,
            "method": "discrete",
            "events": ev,
            "total": tot,
        })
        distribution.append({
            "seriesId": "series-model-a",
            "midpoint": mp,
            "count": count,
            "binWidth": 0.1,
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "calibration",
        "evaluations": [
            {"id": "eval-model-a", "model": "Model A", "population": "Overall Population", "label": "Model A"}
        ],
        "series": [
            {"id": "series-model-a", "evaluationId": "eval-model-a", "display": {"label": "Model A", "group": "Model A", "role": "model"}}
        ],
        "data": data,
        "distribution": distribution,
        "x": "predicted",
        "y": "observed",
        "xAxis": {"label": "Predicted probability", "domain": [0, 1]},
        "yAxis": {"label": "Observed probability", "domain": [0, 1]},
        "references": [{"type": "identity", "scope": "global", "label": "Perfectly Calibrated"}],
    }
    (out_dir / "calibration.json").write_text(json.dumps(spec, indent=2))

def generate_calibration_populations():
    midpoints = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
    counts_a = [40, 80, 150, 200, 210, 150, 90, 50, 20, 10] # sum = 1000
    counts_b = [20, 50, 100, 160, 220, 200, 130, 80, 30, 10] # sum = 1000

    data = []
    distribution = []

    for mp, count in zip(midpoints, counts_a):
        obs = round_num(mp * 0.92 + 0.01)
        tot = count
        ev = math.floor(obs * tot + 0.5)
        data.append({
            "seriesId": "series-pop-a",
            "predicted": mp,
            "observed": obs,
            "method": "discrete",
            "events": ev,
            "total": tot,
        })
        distribution.append({
            "seriesId": "series-pop-a",
            "midpoint": mp,
            "count": count,
            "binWidth": 0.1,
        })

    for mp, count in zip(midpoints, counts_b):
        obs = round_num(mp * 1.05 - 0.02)
        obs = max(0.0, min(1.0, obs))
        tot = count
        ev = math.floor(obs * tot + 0.5)
        data.append({
            "seriesId": "series-pop-b",
            "predicted": mp,
            "observed": obs,
            "method": "discrete",
            "events": ev,
            "total": tot,
        })
        distribution.append({
            "seriesId": "series-pop-b",
            "midpoint": mp,
            "count": count,
            "binWidth": 0.1,
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "calibration",
        "evaluations": [
            {"id": "eval-pop-a", "population": "Population A", "label": "Population A"},
            {"id": "eval-pop-b", "population": "Population B", "label": "Population B"},
        ],
        "series": [
            {"id": "series-pop-a", "evaluationId": "eval-pop-a", "display": {"label": "Population A", "group": "Population A", "role": "population"}},
            {"id": "series-pop-b", "evaluationId": "eval-pop-b", "display": {"label": "Population B", "group": "Population B", "role": "population"}},
        ],
        "data": data,
        "distribution": distribution,
        "x": "predicted",
        "y": "observed",
        "xAxis": {"label": "Predicted probability", "domain": [0, 1]},
        "yAxis": {"label": "Observed probability", "domain": [0, 1]},
        "references": [{"type": "identity", "scope": "global", "label": "Perfectly Calibrated"}],
    }
    (out_dir / "calibration-populations.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 2. ROC
# -----------------------------------------------------------------------------
def generate_roc():
    cutoffs = [round_num(i * 0.02, 2) for i in range(51)] # 0.00 to 1.00
    data = []

    for c in cutoffs:
        # Model A: AUC ~ 0.86
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        spec_a = 1.0 - fpr_a
        ppcr_a = PREVALENCE * tpr_a + (1.0 - PREVALENCE) * fpr_a
        data.append({
            "seriesId": "series-a",
            "cutoff": c,
            "sensitivity": round_num(tpr_a),
            "specificity": round_num(spec_a),
            "ppcr": round_num(ppcr_a),
        })

    for c in cutoffs:
        # Model B: AUC ~ 0.74
        tpr_b = 1.0 - (c ** 1.3)
        fpr_b = (1.0 - c) ** 1.5
        spec_b = 1.0 - fpr_b
        ppcr_b = PREVALENCE * tpr_b + (1.0 - PREVALENCE) * fpr_b
        data.append({
            "seriesId": "series-b",
            "cutoff": c,
            "sensitivity": round_num(tpr_b),
            "specificity": round_num(spec_b),
            "ppcr": round_num(ppcr_b),
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "roc",
        "evaluations": [
            {"id": "eval-a", "model": "Model A", "population": "Pop 1", "label": "Model A"},
            {"id": "eval-b", "model": "Model B", "population": "Pop 1", "label": "Model B"},
        ],
        "series": [
            {"id": "series-a", "evaluationId": "eval-a", "display": {"label": "Model A", "group": "Model A", "role": "model"}},
            {"id": "series-b", "evaluationId": "eval-b", "display": {"label": "Model B", "group": "Model B", "role": "model"}},
        ],
        "data": data,
        "x": "false_positive_rate",
        "y": "sensitivity",
        "xAxis": {"label": "1 - Specificity", "domain": [0, 1]},
        "yAxis": {"label": "Sensitivity", "domain": [0, 1]},
        "references": [{"type": "identity", "scope": "global", "label": "Random Guess"}],
    }
    (out_dir / "roc.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 3. Precision-Recall
# -----------------------------------------------------------------------------
def generate_precision_recall():
    cutoffs = [round_num(i * 0.02, 2) for i in range(51)]
    data = []

    for c in cutoffs:
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        pos_a = PREVALENCE * tpr_a
        ppcr_a = pos_a + (1.0 - PREVALENCE) * fpr_a
        ppv_a = pos_a / ppcr_a if ppcr_a > 0 else 1.0
        data.append({
            "seriesId": "series-a",
            "cutoff": c,
            "sensitivity": round_num(tpr_a),
            "ppv": round_num(min(1.0, ppv_a)),
        })

    for c in cutoffs:
        tpr_b = 1.0 - (c ** 1.3)
        fpr_b = (1.0 - c) ** 1.5
        pos_b = PREVALENCE * tpr_b
        ppcr_b = pos_b + (1.0 - PREVALENCE) * fpr_b
        ppv_b = pos_b / ppcr_b if ppcr_b > 0 else 1.0
        data.append({
            "seriesId": "series-b",
            "cutoff": c,
            "sensitivity": round_num(tpr_b),
            "ppv": round_num(min(1.0, ppv_b)),
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "precision_recall",
        "evaluations": [
            {"id": "eval-a", "model": "Model A", "population": "Pop 1", "label": "Model A"},
            {"id": "eval-b", "model": "Model B", "population": "Pop 1", "label": "Model B"},
        ],
        "series": [
            {"id": "series-a", "evaluationId": "eval-a", "display": {"label": "Model A", "group": "Model A", "role": "model"}},
            {"id": "series-b", "evaluationId": "eval-b", "display": {"label": "Model B", "group": "Model B", "role": "model"}},
        ],
        "data": data,
        "x": "sensitivity",
        "y": "ppv",
        "xAxis": {"label": "Sensitivity (Recall)", "domain": [0, 1]},
        "yAxis": {"label": "Positive Predictive Value (Precision)", "domain": [0, 1]},
        "references": [{"type": "horizontal", "scope": "global", "label": "Random Guess", "value": PREVALENCE}],
    }
    (out_dir / "precision-recall-shared-population.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 4. Gains
# -----------------------------------------------------------------------------
def generate_gains():
    cutoffs = [round_num(i * 0.02, 2) for i in range(51)]
    data = []

    for c in cutoffs:
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        ppcr_a = PREVALENCE * tpr_a + (1.0 - PREVALENCE) * fpr_a
        data.append({
            "seriesId": "series-a",
            "ppcr": round_num(ppcr_a),
            "sensitivity": round_num(tpr_a),
            "cutoff": c,
        })

    for c in cutoffs:
        tpr_b = 1.0 - (c ** 1.3)
        fpr_b = (1.0 - c) ** 1.5
        ppcr_b = PREVALENCE * tpr_b + (1.0 - PREVALENCE) * fpr_b
        data.append({
            "seriesId": "series-b",
            "ppcr": round_num(ppcr_b),
            "sensitivity": round_num(tpr_b),
            "cutoff": c,
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "gains",
        "evaluations": [
            {"id": "eval-a", "model": "Model A", "population": "Pop 1", "label": "Model A"},
            {"id": "eval-b", "model": "Model B", "population": "Pop 1", "label": "Model B"},
        ],
        "series": [
            {"id": "series-a", "evaluationId": "eval-a", "display": {"label": "Model A", "group": "Model A", "role": "model"}},
            {"id": "series-b", "evaluationId": "eval-b", "display": {"label": "Model B", "group": "Model B", "role": "model"}},
        ],
        "data": data,
        "x": "ppcr",
        "y": "sensitivity",
        "xAxis": {"label": "PPCR (Percent Positive)", "domain": [0, 1]},
        "yAxis": {"label": "Cumulative Sensitivity", "domain": [0, 1]},
        "references": [
            {"type": "identity", "scope": "global", "label": "Random"},
            {"type": "path", "scope": "global", "label": "Perfect Model", "points": [
                {"x": 0.0, "y": 0.0},
                {"x": PREVALENCE, "y": 1.0},
                {"x": 1.0, "y": 1.0},
            ]}
        ],
    }
    (out_dir / "gains-shared-population.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 5. Lift
# -----------------------------------------------------------------------------
def generate_lift():
    cutoffs = [round_num(i * 0.02, 2) for i in range(51)]
    data_a = []
    data_b = []

    for c in cutoffs:
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        ppcr_a = PREVALENCE * tpr_a + (1.0 - PREVALENCE) * fpr_a
        if ppcr_a >= 0.01:
            lift_a = tpr_a / ppcr_a
            data_a.append({
                "seriesId": "series-a",
                "ppcr": round_num(ppcr_a),
                "lift": round_num(min(4.0, lift_a)),
                "cutoff": c,
            })

    for c in cutoffs:
        tpr_b = 1.0 - (c ** 1.3)
        fpr_b = (1.0 - c) ** 1.5
        ppcr_b = PREVALENCE * tpr_b + (1.0 - PREVALENCE) * fpr_b
        if ppcr_b >= 0.01:
            lift_b = tpr_b / ppcr_b
            data_b.append({
                "seriesId": "series-b",
                "ppcr": round_num(ppcr_b),
                "lift": round_num(min(4.0, lift_b)),
                "cutoff": c,
            })

    spec = {
        "schemaVersion": "2.0",
        "type": "lift",
        "evaluations": [
            {"id": "eval-a", "model": "Model A", "population": "Pop 1", "label": "Model A"},
            {"id": "eval-b", "model": "Model B", "population": "Pop 1", "label": "Model B"},
        ],
        "series": [
            {"id": "series-a", "evaluationId": "eval-a", "display": {"label": "Model A", "group": "Model A", "role": "model"}},
            {"id": "series-b", "evaluationId": "eval-b", "display": {"label": "Model B", "group": "Model B", "role": "model"}},
        ],
        "data": sorted(data_a + data_b, key=lambda d: (d["seriesId"], d["ppcr"])),
        "x": "ppcr",
        "y": "lift",
        "xAxis": {"label": "PPCR (Percent Positive)", "domain": [0, 1]},
        "yAxis": {"label": "Lift", "domain": [0, 4.0]},
        "references": [
            {"type": "horizontal", "scope": "global", "label": "Random", "value": 1.0},
            {"type": "path", "scope": "global", "label": "Perfect Model", "points": [
                {"x": 0.0, "y": 1.0 / PREVALENCE},
                {"x": PREVALENCE, "y": 1.0 / PREVALENCE},
                {"x": 1.0, "y": 1.0},
            ]}
        ],
    }
    (out_dir / "lift-shared-population.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 6. Decision Curve Analysis
# -----------------------------------------------------------------------------
def generate_decision_curve():
    thresholds = [round_num(i * 0.02 + 0.01, 2) for i in range(49)] # 0.01 to 0.97
    data = []
    treat_all_points = []

    for p in thresholds:
        weight = p / (1.0 - p)
        # Treat all net benefit
        nb_all = PREVALENCE - (1.0 - PREVALENCE) * weight
        treat_all_points.append({"x": p, "y": round_num(max(-0.05, nb_all))})

        # Model A
        c = p
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        nb_a = tpr_a * PREVALENCE - fpr_a * (1.0 - PREVALENCE) * weight
        data.append({
            "seriesId": "series-1",
            "cutoff": p,
            "net_benefit": round_num(max(-0.05, nb_a)),
        })

    spec = {
        "schemaVersion": "2.0",
        "type": "decision_curve",
        "evaluations": [
            {"id": "eval-1", "model": "Model A", "population": "Population A", "label": "Model A"}
        ],
        "series": [
            {"id": "series-1", "evaluationId": "eval-1", "display": {"label": "Model A", "group": "Model A", "role": "model"}}
        ],
        "data": data,
        "x": "probability_threshold",
        "y": "net_benefit",
        "xAxis": {"label": "Threshold Probability", "domain": [0, 1]},
        "yAxis": {"label": "Net Benefit", "domain": [-0.05, PREVALENCE + 0.05]},
        "references": [
            {"type": "horizontal", "scope": "global", "label": "Treat None", "value": 0.0},
            {"type": "path", "scope": "global", "label": "Treat All — Population A", "points": treat_all_points},
        ],
    }
    (out_dir / "decision-curve-single.json").write_text(json.dumps(spec, indent=2))


# -----------------------------------------------------------------------------
# 7. Net Interventions Avoided
# -----------------------------------------------------------------------------
def generate_interventions_avoided():
    thresholds = [round_num(i * 0.02 + 0.01, 2) for i in range(49)]
    data = []
    treat_none_points = []

    for p in thresholds:
        weight = p / (1.0 - p)
        nb_all = PREVALENCE - (1.0 - PREVALENCE) * weight

        c = p
        tpr_a = 1.0 - (c ** 1.8)
        fpr_a = (1.0 - c) ** 2.2
        nb_a = tpr_a * PREVALENCE - fpr_a * (1.0 - PREVALENCE) * weight

        nia_a = ((nb_a - nb_all) / weight) * 100.0 if weight > 0 else 0.0
        data.append({
            "seriesId": "series-1",
            "cutoff": p,
            "net_interventions_avoided": round_num(max(-10.0, min(100.0, nia_a))),
        })

        nia_none = ((0.0 - nb_all) / weight) * 100.0 if weight > 0 else 0.0
        treat_none_points.append({"x": p, "y": round_num(max(-10.0, min(100.0, nia_none)))})

    spec = {
        "schemaVersion": "2.0",
        "type": "interventions_avoided",
        "evaluations": [
            {"id": "eval-1", "model": "Model A", "population": "Population A", "label": "Model A"}
        ],
        "series": [
            {"id": "series-1", "evaluationId": "eval-1", "display": {"label": "Model A", "group": "Model A", "role": "model"}}
        ],
        "data": data,
        "x": "probability_threshold",
        "y": "net_interventions_avoided",
        "xAxis": {"label": "Threshold Probability", "domain": [0, 1]},
        "yAxis": {"label": "Net Interventions Avoided per 100", "domain": [-10, 100]},
        "references": [
            {"type": "horizontal", "scope": "global", "label": "Treat All", "value": 0.0},
            {"type": "path", "scope": "global", "label": "Treat None — Population A", "points": treat_none_points},
        ],
    }
    (out_dir / "interventions-avoided-single.json").write_text(json.dumps(spec, indent=2))


if __name__ == "__main__":
    generate_calibration_single()
    generate_calibration_populations()
    generate_roc()
    generate_precision_recall()
    generate_gains()
    generate_lift()
    generate_decision_curve()
    generate_interventions_avoided()
    print("Demo fixtures generated successfully under fixtures/v2/demo/!")
