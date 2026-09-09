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

    # Display intervals from 0.00 to 1.00 in steps of 0.01
    for i in range(0, 100):
        lower = round(i * 0.01, 2)
        upper = round((i + 1) * 0.01, 2)
        x = (i + 0.5) / 100.0  # midpoint

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

def create_producer_rank_bins(eval_id, bins, num_quantiles=100):
    total_positives = sum(b["nPositive"] for b in bins)
    total_negatives = sum(b["nNegative"] for b in bins)
    total_n = total_positives + total_negatives

    rank_bins = []
    # Generate 100 equal-width rank percentile bins [i/100, (i+1)/100]
    for i in range(num_quantiles):
        r_lower = round(i / num_quantiles, 4)
        r_upper = round((i + 1) / num_quantiles, 4)
        r_mid = (r_lower + r_upper) / 2.0

        # Construct realistic outcome composition across rank percentile
        # (higher rank = higher predicted risk = higher event prevalence)
        event_frac = math.pow(r_mid, 1.8) * 0.75
        bin_mass = total_n / float(num_quantiles)

        pos_mass = round(bin_mass * event_frac, 4)
        neg_mass = round(bin_mass * (1.0 - event_frac), 4)

        rank_bins.append({
            "evaluationId": eval_id,
            "rankLower": r_lower,
            "rankUpper": r_upper,
            "positiveMass": pos_mass,
            "negativeMass": neg_mass
        })

    return rank_bins

def calculate_operating_points(eval_id, bins, thresholds, ppcr_mappings):
    total_positives = sum(b["nPositive"] for b in bins)
    total_negatives = sum(b["nNegative"] for b in bins)
    total_n = total_positives + total_negatives

    ops = []

    # Threshold operating points (exact 0.01 grid)
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
    rank_bins = create_producer_rank_bins("Model A", bins, num_quantiles=100)

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
        "rankBins": rank_bins,
        "operatingPoints": ops
    }

def generate_multi_spec():
    bins_a = create_fine_eval_bins("Model A", n_total=3000, model_quality="high")
    bins_b = create_fine_eval_bins("Model B", n_total=3000, model_quality="moderate")
    bins_sub = create_fine_eval_bins("Model A (High Risk)", n_total=2000, model_quality="high")

    rank_bins_a = create_producer_rank_bins("Model A", bins_a, num_quantiles=100)
    rank_bins_b = create_producer_rank_bins("Model B", bins_b, num_quantiles=100)
    rank_bins_sub = create_producer_rank_bins("Model A (High Risk)", bins_sub, num_quantiles=100)

    thresholds = [round(i * 0.01, 2) for i in range(101)]
    ppcr_mappings = [
        (0.0, 1.00), (0.1, 0.85), (0.2, 0.72), (0.3, 0.60), (0.4, 0.50),
        (0.5, 0.40), (0.6, 0.30), (0.7, 0.20), (0.8, 0.12), (0.9, 0.05), (1.0, 0.0)
    ]

    ops_a = calculate_operating_points("Model A", bins_a, thresholds, ppcr_mappings)
    ops_b = calculate_operating_points("Model B", bins_b, thresholds, ppcr_mappings)
    ops_sub = calculate_operating_points("Model A (High Risk)", bins_sub, thresholds, ppcr_mappings)

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

def generate_ppcr_tie_spec():
    # Dedicated fixture with a large tied-score group crossing rank boundaries
    # Total N = 1000. Tied score group has 200 subjects (20% of population) with 40 events and 160 non-events
    # Covering rank [0.15, 0.35].
    # Spans across 10 percentile bins (0.0..0.1, 0.1..0.2, etc.)
    bins = [
        {"evaluationId": "Model Tie", "lower": 0.0, "upper": 0.0, "includeLower": True, "includeUpper": True, "nPositive": 10, "nNegative": 90},
        {"evaluationId": "Model Tie", "lower": 0.0, "upper": 0.25, "includeLower": False, "includeUpper": True, "nPositive": 40, "nNegative": 160}, # Tied group
        {"evaluationId": "Model Tie", "lower": 0.25, "upper": 1.00, "includeLower": False, "includeUpper": True, "nPositive": 200, "nNegative": 500},
    ]

    # Deterministic rankBins demonstrating fractional allocation across percentile boundaries
    rank_bins = []
    # 10 percentile bins of width 0.10
    # Bin 0: [0.0, 0.1]
    rank_bins.append({"evaluationId": "Model Tie", "rankLower": 0.0, "rankUpper": 0.1, "positiveMass": 10.0, "negativeMass": 90.0})
    # Bin 1: [0.1, 0.2] (Half from bin0, half from tied group)
    rank_bins.append({"evaluationId": "Model Tie", "rankLower": 0.1, "rankUpper": 0.2, "positiveMass": 10.0, "negativeMass": 40.0})
    # Bin 2: [0.2, 0.3] (Fully inside tied group: 20 positiveMass, 80 negativeMass)
    rank_bins.append({"evaluationId": "Model Tie", "rankLower": 0.2, "rankUpper": 0.3, "positiveMass": 20.0, "negativeMass": 80.0})
    # Bin 3: [0.3, 0.4] (Half from tied group: 10 positiveMass, 40 negativeMass + rest)
    rank_bins.append({"evaluationId": "Model Tie", "rankLower": 0.3, "rankUpper": 0.4, "positiveMass": 25.0, "negativeMass": 75.0})

    for i in range(4, 10):
        rank_bins.append({
            "evaluationId": "Model Tie",
            "rankLower": round(i * 0.1, 2),
            "rankUpper": round((i + 1) * 0.1, 2),
            "positiveMass": 30.0,
            "negativeMass": 70.0
        })

    ops = calculate_operating_points("Model Tie", bins, [0.0, 0.25, 0.50, 1.0], [(0.0, 1.0), (0.2, 0.25), (1.0, 0.0)])

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": "PPCR Tie Spec with Producer-Owned Rank Bins",
        "evaluations": [{"id": "Model Tie", "model": "Model Tie", "population": "Pop"}],
        "operatingPoint": {"dimension": "ppcr"},
        "bins": bins,
        "rankBins": rank_bins,
        "operatingPoints": ops
    }

if __name__ == "__main__":
    single_spec = generate_single_spec()
    multi_spec = generate_multi_spec()
    tie_spec = generate_ppcr_tie_spec()

    with open("fixtures/v2/prediction-distribution-single.json", "w") as f:
        json.dump(single_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-multi.json", "w") as f:
        json.dump(multi_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-visual.json", "w") as f:
        json.dump(multi_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-threshold.json", "w") as f:
        json.dump(single_spec, f, indent=2)

    with open("fixtures/v2/prediction-distribution-ppcr-tie.json", "w") as f:
        json.dump(tie_spec, f, indent=2)

    print("Successfully updated realistic prediction distribution fixtures with producer-owned rankBins.")
