import json
import math

def create_fine_eval_bins(eval_id, n_total=3000, model_quality="high"):
    bins = []

    # Bin 0: [0, 0]
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

    for i in range(0, 100):
        lower = round(i * 0.01, 2)
        upper = round((i + 1) * 0.01, 2)
        x = (i + 0.5) / 100.0

        if i == 0:
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

def find_empirical_cutoff_for_ppcr(bins, requested_ppcr, total_n):
    if requested_ppcr <= 0:
        return 1.0
    if requested_ppcr >= 1.0:
        return 0.0

    target_count = total_n * requested_ppcr
    cum = 0
    non_zero_bins = [b for b in bins if not (b["lower"] == 0 and b["upper"] == 0)]
    sorted_bins_desc = sorted(non_zero_bins, key=lambda b: b["upper"], reverse=True)

    for b in sorted_bins_desc:
        bin_count = b["nPositive"] + b["nNegative"]
        cum += bin_count
        if cum >= target_count:
            return b["lower"]

    return 0.0

def calculate_operating_points(eval_id, bins, thresholds, ppcr_grid):
    total_positives = sum(b["nPositive"] for b in bins)
    total_negatives = sum(b["nNegative"] for b in bins)
    total_n = total_positives + total_negatives
    prev = total_positives / total_n if total_n > 0 else 0.1

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
        lift = ppv / prev if prev > 0 else 1.0

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
                {"metricId": "lift", "estimate": round(lift, 6)},
            ]
        })

    # PPCR operating points with empirical quantile cutoff derivation Q_(1-p)(score)
    for p_req in ppcr_grid:
        cut = find_empirical_cutoff_for_ppcr(bins, p_req, total_n)

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
        lift = ppv / prev if prev > 0 else 1.0

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
                {"metricId": "lift", "estimate": round(lift, 6)},
            ]
        })

    return ops

def create_rank_bins_from_ops(eval_id, ops):
    ppcr_ops = [op for op in ops if op["type"] == "ppcr"]
    ppcr_ops.sort(key=lambda op: op["value"])

    rank_bins = []
    for i in range(len(ppcr_ops) - 1):
        op_prev = ppcr_ops[i]
        op_curr = ppcr_ops[i + 1]

        r_lower = round(op_prev["value"], 4)
        r_upper = round(op_curr["value"], 4)

        tp_prev = next(m["estimate"] for m in op_prev["performance"] if m["metricId"] == "true_positives")
        fp_prev = next(m["estimate"] for m in op_prev["performance"] if m["metricId"] == "false_positives")

        tp_curr = next(m["estimate"] for m in op_curr["performance"] if m["metricId"] == "true_positives")
        fp_curr = next(m["estimate"] for m in op_curr["performance"] if m["metricId"] == "false_positives")

        pos_mass = max(0.0, float(tp_curr - tp_prev))
        neg_mass = max(0.0, float(fp_curr - fp_prev))

        rank_bins.append({
            "evaluationId": eval_id,
            "rankLower": r_lower,
            "rankUpper": r_upper,
            "positiveMass": pos_mass,
            "negativeMass": neg_mass
        })

    return rank_bins

def generate_single_spec():
    bins = create_fine_eval_bins("Model A", n_total=3000, model_quality="high")
    thresholds = [round(i * 0.01, 2) for i in range(101)]
    ppcr_grid = [round(i * 0.01, 2) for i in range(101)]

    ops = calculate_operating_points("Model A", bins, thresholds, ppcr_grid)
    rank_bins = create_rank_bins_from_ops("Model A", ops)

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
        "rankBins": rank_bins,
        "operatingPoints": ops
    }

def generate_multi_spec():
    bins_a = create_fine_eval_bins("Model A", n_total=3000, model_quality="high")
    bins_b = create_fine_eval_bins("Model B", n_total=3000, model_quality="moderate")
    bins_sub = create_fine_eval_bins("Model A (High Risk)", n_total=2000, model_quality="high")

    thresholds = [round(i * 0.01, 2) for i in range(101)]
    ppcr_grid = [round(i * 0.01, 2) for i in range(101)]

    ops_a = calculate_operating_points("Model A", bins_a, thresholds, ppcr_grid)
    ops_b = calculate_operating_points("Model B", bins_b, thresholds, ppcr_grid)
    ops_sub = calculate_operating_points("Model A (High Risk)", bins_sub, thresholds, ppcr_grid)

    rank_bins_a = create_rank_bins_from_ops("Model A", ops_a)
    rank_bins_b = create_rank_bins_from_ops("Model B", ops_b)
    rank_bins_sub = create_rank_bins_from_ops("Model A (High Risk)", ops_sub)

    all_bins = bins_a + bins_b + bins_sub
    all_rank_bins = rank_bins_a + rank_bins_b + rank_bins_sub
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
        "rankBins": all_rank_bins,
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

    print("Successfully updated realistic prediction distribution fixtures with empirical quantile PPCR cutoff derivation.")
