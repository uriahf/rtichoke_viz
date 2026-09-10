import json

def add_performance_to_fixture(filepath):
    with open(filepath, "r") as f:
        spec = json.load(f)

    bins = spec["bins"]
    ops = spec["operatingPoints"]
    evaluations = spec["evaluations"]

    for op in ops:
        eval_id = op["evaluationId"]
        cut = op["cutoff"]
        eval_bins = [b for b in bins if b["evaluationId"] == eval_id]

        total_positives = sum(b["nPositive"] for b in eval_bins)
        total_negatives = sum(b["nNegative"] for b in eval_bins)
        total_n = total_positives + total_negatives

        tp = 0
        fp = 0
        fn = 0
        tn = 0

        for b in eval_bins:
            is_pos = True if cut == 0 else b["upper"] > cut
            if is_pos:
                tp += b["nPositive"]
                fp += b["nNegative"]
            else:
                fn += b["nPositive"]
                tn += b["nNegative"]

        sens = tp / total_positives if total_positives > 0 else 0
        spec_val = tn / total_negatives if total_negatives > 0 else 0
        ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0

        op["performance"] = [
            {"metricId": "true_positives", "estimate": tp},
            {"metricId": "false_positives", "estimate": fp},
            {"metricId": "true_negatives", "estimate": tn},
            {"metricId": "false_negatives", "estimate": fn},
            {"metricId": "sensitivity", "estimate": round(sens, 6)},
            {"metricId": "specificity", "estimate": round(spec_val, 6)},
            {"metricId": "ppv", "estimate": round(ppv, 6)},
            {"metricId": "npv", "estimate": round(npv, 6)},
        ]

    with open(filepath, "w") as f:
        json.dump(spec, f, indent=2)

if __name__ == "__main__":
    add_performance_to_fixture("fixtures/v2/prediction-distribution-threshold.json")
    add_performance_to_fixture("fixtures/v2/prediction-distribution-ppcr-tie.json")
    print("Successfully added precomputed performance to threshold and ppcr-tie fixtures.")
