import json
import math

def create_fine_eval_bins(eval_id, n_total=3000, model_quality="high"):
    bins = []

    # Bin 0: [0, 0] - Modest, plausible exact-zero count (Blocker 2)
    if model_quality == "high":
        bin0_pos = 1
        bin0_neg = 14
    else:
        bin0_pos = 1
        bin0_neg = 9

    bins.append({
        "evaluationId": eval_id,
        "lower": 0.0,
        "upper": 0.0,
        "includeLower": True,
        "includeUpper": True,
        "nPositive": bin0_pos,
        "nNegative": bin0_neg
    })

    # Display intervals from 0.00 to 1.00 in steps of 0.01 (Blocker 1 & 2)
    # The first interval (0.00, 0.01] has a modest, plausible count
    for i in range(0, 100):
        lower = round(i * 0.01, 2)
        upper = round((i + 1) * 0.01, 2)
        x = (i + 0.5) / 100.0  # midpoint

        if i == 0:
            # Modest count for (0.00, 0.01] so total [0, 0.01) is reasonable
            pos_count = 2
            neg_count = 18
        else:
            if model_quality == "high":
                pos_weight = math.pow(x, 2.2)
                neg_weight = math.pow(1.0 - x, 2.2)
            else:
                pos_weight = math.pow(x, 1.2)
                neg_weight = math.pow(1.0 - x, 1.2)

            pos_count = max(0, int(round(pos_weight * 25)))
            neg_count = max(0, int(round(neg_weight * 35)))

        bins.append({
            "evaluationId": eval_id,
            "lower": lower,
            "upper": upper,
            "includeLower": False,
            "includeUpper": True,
            "nPositive": pos_count,
            "nNegative": neg_count
        })

    return bins

def calculate_operating_points(eval_id, bins, thresholds, ppcr_mappings):
    total_positives = sum(b["nPositive"] for b in bins)
    total_negatives = sum(b["nNegative"] for b in bins)
    total_n = total_positives + total_negatives

    ops = []

    # Threshold operating points (exact 0.01 grid: 0.00, 0.01, ..., 1.00)
    for cut in thresholds:
        tp = 0
        fp = 0
        fn = 0
        tn = 0
        for b in bins:
            is_pos = True if cut == 0 else b["upper"] > cut
            if is_pos:
                tp += b["nPositive"]
                fp += b["nNegative"]
            else:
                fn += b["nPositive"]
                tn += b["nNegative"]

        realized_ppcr = (tp + fp) / total_n
        sens = tp / total_positives if total_positives > 0 else 0
        spec = tn / total_negatives if total_negatives > 0 else 0
        ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0

        ops.append({
            "evaluationId": eval_id,
            "type": "probability_threshold",
            "value": round(cut, 2),
            "cutoff": round(cut, 2),
            "realizedPpcr": round(realized_ppcr, 6),
            "performance": [
                {"metricId": "true_positives", "estimate": tp},
                {"metricId": "false_positives", "estimate": fp},
                {"metricId": "true_negatives", "estimate": tn},
                {"metricId": "false_negatives", "estimate": fn},
                {"metricId": "sensitivity", "estimate": round(sens, 6)},
                {"metricId": "specificity", "estimate": round(spec, 6)},
                {"metricId": "ppv", "estimate": round(ppv, 6)},
                {"metricId": "npv", "estimate": round(npv, 6)},
            ]
        })

    # PPCR operating points with explicitly mapped cutoffs
    for p_req, cut in ppcr_mappings:
        tp = 0
        fp = 0
        fn = 0
        tn = 0
        for b in bins:
            is_pos = True if cut == 0 else b["upper"] > cut
            if is_pos:
                tp += b["nPositive"]
                fp += b["nNegative"]
            else:
                fn += b["nPositive"]
                tn += b["nNegative"]

        realized_ppcr = (tp + fp) / total_n
        sens = tp / total_positives if total_positives > 0 else 0
        spec = tn / total_negatives if total_negatives > 0 else 0
        ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0

        ops.append({
            "evaluationId": eval_id,
            "type": "ppcr",
            "value": round(p_req, 2),
            "cutoff": round(cut, 2),
            "realizedPpcr": round(realized_ppcr, 6),
            "performance": [
                {"metricId": "true_positives", "estimate": tp},
                {"metricId": "false_positives", "estimate": fp},
                {"metricId": "true_negatives", "estimate": tn},
                {"metricId": "false_negatives", "estimate": fn},
                {"metricId": "sensitivity", "estimate": round(sens, 6)},
                {"metricId": "specificity", "estimate": round(spec, 6)},
                {"metricId": "ppv", "estimate": round(ppv, 6)},
                {"metricId": "npv", "estimate": round(npv, 6)},
            ]
        })

    return ops

def generate_single_spec():
    bins = create_fine_eval_bins("Model A", n_total=3000, model_quality="high")
    # Operating point threshold grid strictly 0.00 to 1.00 in steps of 0.01
    thresholds = [round(i * 0.01, 2) for i in range(101)]
    ppcr_mappings = [
        (0.0, 1.00), (0.1, 0.85), (0.2, 0.72), (0.3, 0.60), (0.4, 0.50),
        (0.5, 0.40), (0.6, 0.30), (0.7, 0.20), (0.8, 0.12), (0.9, 0.05), (1.0, 0.0)
    ]
    ops = calculate_operating_points("Model A", bins, thresholds, ppcr_mappings)

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": "Realistic Single Model Prediction Distribution (by = 0.01)",
        "evaluations": [
            {
                "id": "Model A",
                "model": "Model A",
                "population": "Overall Population"
            }
        ],
        "operatingPoint": {
            "dimension": "probability_threshold"
        },
        "bins": bins,
        "operatingPoints": ops
    }

def generate_multi_spec():
    bins_a = create_fine_eval_bins("Model A", n_total=3000, model_quality="high")
    bins_b = create_fine_eval_bins("Model B", n_total=3000, model_quality="moderate")
    bins_sub = create_fine_eval_bins("Model A (High Risk)", n_total=2000, model_quality="high")

    thresholds = [round(i * 0.01, 2) for i in range(101)]
    ppcr_mappings = [
        (0.0, 1.00), (0.1, 0.85), (0.2, 0.72), (0.3, 0.60), (0.4, 0.50),
        (0.5, 0.40), (0.6, 0.30), (0.7, 0.20), (0.8, 0.12), (0.9, 0.05), (1.0, 0.0)
    ]

    ops_a = calculate_operating_points("Model A", bins_a, thresholds, ppcr_mappings)
    ops_b = calculate_operating_points("Model B", bins_b, thresholds, ppcr_mappings)
    ops_sub = calculate_operating_points("Model A (High Risk)", bins_sub, thresholds, ppcr_mappings)

    all_bins = bins_a + bins_b + bins_sub
    all_ops = ops_a + ops_b + ops_sub

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": "Realistic Multi-Evaluation Prediction Distribution (by = 0.01)",
        "evaluations": [
            {
                "id": "Model A",
                "model": "Model A (High Accuracy)",
                "population": "Overall Population",
                "label": "Model A (High Accuracy)"
            },
            {
                "id": "Model B",
                "model": "Model B (Moderate Accuracy)",
                "population": "Overall Population",
                "label": "Model B (Moderate Accuracy)"
            },
            {
                "id": "Model A (High Risk)",
                "model": "Model A (High Accuracy)",
                "population": "High-Risk Subgroup",
                "label": "Model A (High Risk Subgroup)"
            }
        ],
        "operatingPoint": {
            "dimension": "probability_threshold"
        },
        "bins": all_bins,
        "operatingPoints": all_ops
    }

if __name__ == "__main__":
    single_spec = generate_single_spec()
    multi_spec = generate_multi_spec()

    with open("fixtures/v2/prediction-distribution-single.json", "w") as f:
        json.dump(single_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-multi.json", "w") as f:
        json.dump(multi_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-visual.json", "w") as f:
        json.dump(multi_spec, f, indent=2)

    print("Successfully updated realistic fine-grid prediction distribution fixtures (by = 0.01).")
