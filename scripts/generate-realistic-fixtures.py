import json

def create_eval_bins(eval_id, count_multiplier=3, model_quality="high"):
    if model_quality == "high":
        raw_bins = [
            (0.0, 0.0, True, True, 10, 50),
            (0.0, 0.04, False, True, 5, 240),
            (0.04, 0.08, False, True, 8, 210),
            (0.08, 0.12, False, True, 12, 180),
            (0.12, 0.16, False, True, 18, 150),
            (0.16, 0.20, False, True, 25, 120),
            (0.20, 0.24, False, True, 35, 95),
            (0.24, 0.28, False, True, 48, 75),
            (0.28, 0.32, False, True, 62, 60),
            (0.32, 0.36, False, True, 78, 48),
            (0.36, 0.40, False, True, 95, 38),
            (0.40, 0.44, False, True, 115, 28),
            (0.44, 0.48, False, True, 130, 20),
            (0.48, 0.52, False, True, 142, 14),
            (0.52, 0.56, False, True, 148, 10),
            (0.56, 0.60, False, True, 145, 6),
            (0.60, 0.64, False, True, 135, 4),
            (0.64, 0.68, False, True, 120, 2),
            (0.68, 0.72, False, True, 100, 1),
            (0.72, 0.76, False, True, 80, 0),
            (0.76, 0.80, False, True, 60, 0),
            (0.80, 0.84, False, True, 42, 0),
            (0.84, 0.88, False, True, 26, 0),
            (0.88, 0.92, False, True, 15, 0),
            (0.92, 0.96, False, True, 8, 0),
            (0.96, 1.00, False, True, 3, 0),
        ]
    else:
        raw_bins = [
            (0.0, 0.0, True, True, 5, 25),
            (0.0, 0.04, False, True, 20, 120),
            (0.04, 0.08, False, True, 28, 130),
            (0.08, 0.12, False, True, 35, 140),
            (0.12, 0.16, False, True, 42, 150),
            (0.16, 0.20, False, True, 50, 145),
            (0.20, 0.24, False, True, 58, 135),
            (0.24, 0.28, False, True, 65, 120),
            (0.28, 0.32, False, True, 72, 105),
            (0.32, 0.36, False, True, 80, 90),
            (0.36, 0.40, False, True, 88, 78),
            (0.40, 0.44, False, True, 92, 65),
            (0.44, 0.48, False, True, 95, 52),
            (0.48, 0.52, False, True, 92, 42),
            (0.52, 0.56, False, True, 88, 32),
            (0.56, 0.60, False, True, 80, 24),
            (0.60, 0.64, False, True, 70, 18),
            (0.64, 0.68, False, True, 60, 12),
            (0.68, 0.72, False, True, 50, 8),
            (0.72, 0.76, False, True, 40, 5),
            (0.76, 0.80, False, True, 30, 2),
            (0.80, 0.84, False, True, 22, 1),
            (0.84, 0.88, False, True, 15, 0),
            (0.88, 0.92, False, True, 10, 0),
            (0.92, 0.96, False, True, 5, 0),
            (0.96, 1.00, False, True, 2, 0),
        ]

    out_bins = []
    for lower, upper, inc_l, inc_u, pos, neg in raw_bins:
        out_bins.append({
            "evaluationId": eval_id,
            "lower": lower,
            "upper": upper,
            "includeLower": inc_l,
            "includeUpper": inc_u,
            "nPositive": pos * count_multiplier,
            "nNegative": neg * count_multiplier
        })
    return out_bins

def calculate_operating_points(eval_id, bins, thresholds, ppcr_mappings):
    total_positives = sum(b["nPositive"] for b in bins)
    total_negatives = sum(b["nNegative"] for b in bins)
    total_n = total_positives + total_negatives

    ops = []

    # Threshold operating points
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
            "value": round(cut, 4),
            "cutoff": round(cut, 4),
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
            "value": round(p_req, 4),
            "cutoff": round(cut, 4),
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
    bins = create_eval_bins("Model A", count_multiplier=2, model_quality="high")
    thresholds = [0.0, 0.08, 0.20, 0.32, 0.40, 0.52, 0.60, 0.72, 0.80, 0.92, 1.0]
    ppcr_mappings = [
        (0.0, 0.96), (0.1, 0.76), (0.2, 0.68), (0.3, 0.60), (0.4, 0.52),
        (0.5, 0.44), (0.6, 0.32), (0.7, 0.20), (0.8, 0.12), (0.9, 0.04), (1.0, 0.0)
    ]
    ops = calculate_operating_points("Model A", bins, thresholds, ppcr_mappings)

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": "Realistic Single Model Prediction Distribution",
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
    bins_a = create_eval_bins("Model A", count_multiplier=2, model_quality="high")
    bins_b = create_eval_bins("Model B", count_multiplier=2, model_quality="moderate")
    bins_sub = create_eval_bins("Model A (High Risk)", count_multiplier=1, model_quality="high")

    thresholds = [0.0, 0.08, 0.20, 0.32, 0.40, 0.52, 0.60, 0.72, 0.80, 0.92, 1.0]
    ppcr_mappings = [
        (0.0, 0.96), (0.1, 0.76), (0.2, 0.68), (0.3, 0.60), (0.4, 0.52),
        (0.5, 0.44), (0.6, 0.32), (0.7, 0.20), (0.8, 0.12), (0.9, 0.04), (1.0, 0.0)
    ]

    ops_a = calculate_operating_points("Model A", bins_a, thresholds, ppcr_mappings)
    ops_b = calculate_operating_points("Model B", bins_b, thresholds, ppcr_mappings)
    ops_sub = calculate_operating_points("Model A (High Risk)", bins_sub, thresholds, ppcr_mappings)

    all_bins = bins_a + bins_b + bins_sub
    all_ops = ops_a + ops_b + ops_sub

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": "Realistic Multi-Evaluation Prediction Distribution",
        "evaluations": [
            {
                "id": "Model A",
                "model": "Model A (High Accuracy)",
                "population": "Overall Population"
            },
            {
                "id": "Model B",
                "model": "Model B (Moderate Accuracy)",
                "population": "Overall Population"
            },
            {
                "id": "Model A (High Risk)",
                "model": "Model A (High Accuracy)",
                "population": "High-Risk Subgroup"
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

    print("Successfully generated realistic prediction distribution fixtures.")
