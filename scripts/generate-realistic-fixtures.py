import json
import math
import random

def generate_individual_observations(n_total=3000, model_type='high', seed=42):
    random.seed(seed)
    obs = []
    # Include realistic exact zero score mass
    n_zero = 15 if model_type == 'high' else (10 if model_type == 'moderate' else 12)
    for _ in range(n_zero):
        outcome = 1 if random.random() < 0.05 else 0
        obs.append({'score': 0.0, 'outcome': outcome})

    # Generate smooth continuous score distributions
    while len(obs) < n_total:
        if model_type == 'high':
            z = random.gauss(0, 1.2)
            score = 1.0 / (1.0 + math.exp(-z))
            prob = 1.0 / (1.0 + math.exp(-(z - 0.4)))
        elif model_type == 'moderate':
            z = random.gauss(0, 1.0)
            score = 1.0 / (1.0 + math.exp(-z))
            prob = 1.0 / (1.0 + math.exp(-(z * 0.7 - 0.2)))
        else:
            z = random.gauss(0.2, 1.1)
            score = 1.0 / (1.0 + math.exp(-z))
            prob = 1.0 / (1.0 + math.exp(-(z * 0.9 - 0.1)))

        score = max(0.0001, min(0.9999, score))
        outcome = 1 if random.random() < prob else 0
        obs.append({'score': score, 'outcome': outcome})

    obs.sort(key=lambda x: x['score'])
    return obs

def type7_quantile(sorted_scores, probability):
    n = len(sorted_scores)
    if n == 0:
        return 0.0
    if probability <= 0:
        return sorted_scores[0]
    if probability >= 1:
        return sorted_scores[-1]

    h = (n - 1) * probability
    lower_index = math.floor(h)
    interpolation_weight = h - lower_index

    return (
        (1 - interpolation_weight) * sorted_scores[lower_index]
        + interpolation_weight * sorted_scores[lower_index + 1]
    )

def create_score_histogram_bins(obs, eval_id):
    bins = []
    # Bin 0: [0, 0]
    bin0_pos = sum(1 for x in obs if x['score'] == 0.0 and x['outcome'] == 1)
    bin0_neg = sum(1 for x in obs if x['score'] == 0.0 and x['outcome'] == 0)

    bins.append({
        "evaluationId": eval_id,
        "lower": 0.0,
        "upper": 0.0,
        "includeLower": True,
        "includeUpper": True,
        "nPositive": bin0_pos,
        "nNegative": bin0_neg
    })

    for i in range(100):
        lower = round(i * 0.01, 2)
        upper = round((i + 1) * 0.01, 2)

        pos_count = 0
        neg_count = 0
        for x in obs:
            s = x['score']
            if lower < s <= upper:
                if x['outcome'] == 1: pos_count += 1
                else: neg_count += 1

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

def create_producer_rank_bins(obs, eval_id, by=0.01):
    scores = sorted(x['score'] for x in obs)
    n_grid = int(round(1.0 / by))
    grid = [i * by for i in range(n_grid + 1)]
    q_bounds = [type7_quantile(scores, p) for p in grid]

    rank_bins = []
    for rank_index in range(n_grid):
        r_lower = round(rank_index * by, 4)
        r_upper = round((rank_index + 1) * by, 4)
        lower_score_boundary = q_bounds[rank_index]
        upper_score_boundary = q_bounds[rank_index + 1]

        pos_mass = 0
        neg_mass = 0
        for item in obs:
            s = item['score']
            in_bin = (lower_score_boundary <= s <= upper_score_boundary) if rank_index == 0 else (lower_score_boundary < s <= upper_score_boundary)
            if in_bin:
                if item['outcome'] == 1: pos_mass += 1
                else: neg_mass += 1

        rank_bins.append({
            'evaluationId': eval_id,
            'rankLower': r_lower,
            'rankUpper': r_upper,
            'positiveMass': pos_mass,
            'negativeMass': neg_mass
        })
    return rank_bins

def calculate_producer_ops(obs, eval_id, bins, thresholds, ppcr_grid):
    n_total = len(obs)
    n_pos_total = sum(1 for x in obs if x['outcome'] == 1)
    n_neg_total = n_total - n_pos_total
    prev = n_pos_total / n_total if n_total > 0 else 0.1
    scores = sorted(x['score'] for x in obs)

    ops = []
    # Threshold operating points
    for cut in thresholds:
        tp, fp, fn, tn = 0, 0, 0, 0
        for b in bins:
            is_pos = True if cut == 0 else b['upper'] > cut
            if is_pos:
                tp += b['nPositive']
                fp += b['nNegative']
            else:
                fn += b['nPositive']
                tn += b['nNegative']

        realized_ppcr = (tp + fp) / n_total
        sens = tp / n_pos_total if n_pos_total > 0 else 0
        spec = tn / n_neg_total if n_neg_total > 0 else 0
        ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0
        lift = ppv / prev if prev > 0 else 1.0

        ops.append({
            'evaluationId': eval_id,
            'type': 'probability_threshold',
            'value': round(cut, 2),
            'cutoff': round(cut, 2),
            'realizedPpcr': round(realized_ppcr, 6),
            'performance': [
                {'metricId': 'true_positives', 'estimate': tp},
                {'metricId': 'false_positives', 'estimate': fp},
                {'metricId': 'true_negatives', 'estimate': tn},
                {'metricId': 'false_negatives', 'estimate': fn},
                {'metricId': 'sensitivity', 'estimate': round(sens, 6)},
                {'metricId': 'specificity', 'estimate': round(spec, 6)},
                {'metricId': 'ppv', 'estimate': round(ppv, 6)},
                {'metricId': 'npv', 'estimate': round(npv, 6)},
                {'metricId': 'lift', 'estimate': round(lift, 6)},
            ]
        })

    # Exact R producer PPCR operating points with full-precision Type-7 quantile classification
    for p_req in ppcr_grid:
        if p_req == 0:
            predicted_positive = [False for _ in obs]
            cutoff = max(x['score'] for x in obs)
        elif p_req == 1:
            predicted_positive = [True for _ in obs]
            cutoff = 0.0
        else:
            cutoff = type7_quantile(scores, 1.0 - p_req)
            predicted_positive = [x['score'] > cutoff for x in obs]

        tp = sum(1 for item, is_pos in zip(obs, predicted_positive) if is_pos and item['outcome'] == 1)
        fp = sum(1 for item, is_pos in zip(obs, predicted_positive) if is_pos and item['outcome'] == 0)
        fn = sum(1 for item, is_pos in zip(obs, predicted_positive) if not is_pos and item['outcome'] == 1)
        tn = sum(1 for item, is_pos in zip(obs, predicted_positive) if not is_pos and item['outcome'] == 0)

        realized_ppcr = (tp + fp) / n_total
        sens = tp / n_pos_total if n_pos_total > 0 else 0
        spec = tn / n_neg_total if n_neg_total > 0 else 0
        ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0
        lift = ppv / prev if prev > 0 else 1.0

        ops.append({
            'evaluationId': eval_id,
            'type': 'ppcr',
            'value': round(p_req, 2),
            'cutoff': round(cutoff, 4),
            'realizedPpcr': round(realized_ppcr, 6),
            'performance': [
                {'metricId': 'true_positives', 'estimate': tp},
                {'metricId': 'false_positives', 'estimate': fp},
                {'metricId': 'true_negatives', 'estimate': tn},
                {'metricId': 'false_negatives', 'estimate': fn},
                {'metricId': 'sensitivity', 'estimate': round(sens, 6)},
                {'metricId': 'specificity', 'estimate': round(spec, 6)},
                {'metricId': 'ppv', 'estimate': round(ppv, 6)},
                {'metricId': 'npv', 'estimate': round(npv, 6)},
                {'metricId': 'lift', 'estimate': round(lift, 6)},
            ]
        })
    return ops

def generate_single_spec():
    obs = generate_individual_observations(3000, 'high', seed=42)
    bins = create_score_histogram_bins(obs, "Model A")
    grid = [round(i * 0.01, 2) for i in range(101)]

    ops = calculate_producer_ops(obs, "Model A", bins, grid, grid)
    rank_bins = create_producer_rank_bins(obs, "Model A", 0.01)

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
    obs_a = generate_individual_observations(3000, 'high', seed=42)
    obs_b = generate_individual_observations(3000, 'moderate', seed=101)
    obs_sub = generate_individual_observations(2000, 'high_risk', seed=202)

    bins_a = create_score_histogram_bins(obs_a, "Model A")
    bins_b = create_score_histogram_bins(obs_b, "Model B")
    bins_sub = create_score_histogram_bins(obs_sub, "Model A (High Risk)")

    grid = [round(i * 0.01, 2) for i in range(101)]

    ops_a = calculate_producer_ops(obs_a, "Model A", bins_a, grid, grid)
    ops_b = calculate_producer_ops(obs_b, "Model B", bins_b, grid, grid)
    ops_sub = calculate_producer_ops(obs_sub, "Model A (High Risk)", bins_sub, grid, grid)

    rank_bins_a = create_producer_rank_bins(obs_a, "Model A", 0.01)
    rank_bins_b = create_producer_rank_bins(obs_b, "Model B", 0.01)
    rank_bins_sub = create_producer_rank_bins(obs_sub, "Model A (High Risk)", 0.01)

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
        "bins": bins_a + bins_b + bins_sub,
        "rankBins": rank_bins_a + rank_bins_b + rank_bins_sub,
        "operatingPoints": ops_a + ops_b + ops_sub
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

    print("Successfully generated observation-level realistic prediction distribution fixtures!")
