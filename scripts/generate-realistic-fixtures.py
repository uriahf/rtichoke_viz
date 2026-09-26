import json
import math
import os
import sys
import random

def generate_individual_observations(n_total=3000, model_type='high', seed=42):
    random.seed(seed)
    obs = []
    # Include realistic exact zero score mass
    n_zero = 15 if model_type == 'high' else (10 if model_type == 'moderate' else (12 if model_type == 'high_val' else 14))
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
        elif model_type == 'high_val':
            z = random.gauss(0.1, 1.1)
            score = 1.0 / (1.0 + math.exp(-z))
            prob = 1.0 / (1.0 + math.exp(-(z * 0.9 - 0.3)))
        else:
            z = random.gauss(0.2, 1.1)
            score = 1.0 / (1.0 + math.exp(-z))
            prob = 1.0 / (1.0 + math.exp(-(z * 0.9 - 0.1)))

        score = max(0.0001, min(0.9999, score))
        outcome = 1 if random.random() < prob else 0
        obs.append({'score': score, 'outcome': outcome})

    obs.sort(key=lambda x: x['score'])
    return obs

def generate_paired_test_observations(n_total=3000, seed=42):
    obs_a = generate_individual_observations(n_total, 'high', seed)
    outcomes = [x['outcome'] for x in obs_a]
    scores_a = [x['score'] for x in obs_a]

    random.seed(seed + 100)
    scores_b = []
    for i in range(n_total):
        if scores_a[i] == 0.0:
            scores_b.append(0.0)
        else:
            y = outcomes[i]
            z = random.gauss(0.5 if y == 1 else -0.5, 1.1)
            sb = max(0.0001, min(0.9999, 1.0 / (1.0 + math.exp(-z))))
            scores_b.append(sb)

    obs_b = [{'score': sb, 'outcome': y} for sb, y in zip(scores_b, outcomes)]
    obs_b.sort(key=lambda x: x['score'])
    return obs_a, obs_b

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
                {'metricId': 'sensitivity', 'estimate': round(sens, 4)},
                {'metricId': 'specificity', 'estimate': round(spec, 4)},
                {'metricId': 'ppv', 'estimate': round(ppv, 4)},
                {'metricId': 'npv', 'estimate': round(npv, 4)},
                {'metricId': 'lift', 'estimate': round(lift, 4)},
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
                {'metricId': 'sensitivity', 'estimate': round(sens, 4)},
                {'metricId': 'specificity', 'estimate': round(spec, 4)},
                {'metricId': 'ppv', 'estimate': round(ppv, 4)},
                {'metricId': 'npv', 'estimate': round(npv, 4)},
                {'metricId': 'lift', 'estimate': round(lift, 4)},
            ]
        })
    return ops

def calculate_auroc(obs):
    pos = [x for x in obs if x['outcome'] == 1]
    neg = [x for x in obs if x['outcome'] == 0]
    n_pos = len(pos)
    n_neg = len(neg)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    sorted_obs = sorted(obs, key=lambda x: x['score'])
    sum_ranks_pos = 0
    n = len(sorted_obs)
    i = 0
    while i < n:
        j = i
        while j < n and sorted_obs[j]['score'] == sorted_obs[i]['score']:
            j += 1
        avg_rank = (i + 1 + j) / 2.0
        for k in range(i, j):
            if sorted_obs[k]['outcome'] == 1:
                sum_ranks_pos += avg_rank
        i = j
    auroc = (sum_ranks_pos - (n_pos * (n_pos + 1) / 2.0)) / (n_pos * n_neg)
    return round(auroc, 4)

def create_calibration_groups(obs, series_id, num_groups=10):
    sorted_obs = sorted(obs, key=lambda x: x['score'])
    n = len(sorted_obs)
    group_size = n / float(num_groups)
    discrete_data = []

    for i in range(num_groups):
        idx_start = int(round(i * group_size))
        idx_end = int(round((i + 1) * group_size)) if i < num_groups - 1 else n
        group_obs = sorted_obs[idx_start:idx_end]
        if not group_obs:
            continue
        tot = len(group_obs)
        evs = sum(1 for x in group_obs if x['outcome'] == 1)
        mean_pred = sum(x['score'] for x in group_obs) / float(tot)
        obs_prop = evs / float(tot)

        discrete_data.append({
            "seriesId": series_id,
            "predicted": round(mean_pred, 4),
            "observed": round(obs_prop, 4),
            "method": "discrete",
            "events": evs,
            "total": tot
        })

    return discrete_data

def build_roc_spec(evaluations, eval_obs_map, thresholds):
    eval_list = []
    series_list = []
    data_list = []

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        n_tot = len(obs)
        n_pos = sum(1 for x in obs if x['outcome'] == 1)
        n_neg = n_tot - n_pos

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        series_id = f"series-{eval_id}"
        role = "population" if ev.get('is_pop_comparison') else "model"
        disp_label = ev['population'] if role == "population" else (ev.get('model') or ev.get('label'))

        series_list.append({
            "id": series_id,
            "evaluationId": eval_id,
            "display": {
                "label": disp_label,
                "group": disp_label,
                "role": role
            }
        })

        for cut in thresholds:
            if cut == 0:
                tp = n_pos
                fp = n_neg
            else:
                tp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 1)
                fp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 0)

            sens = tp / float(n_pos) if n_pos > 0 else 0.0
            tn = n_neg - fp
            spec = tn / float(n_neg) if n_neg > 0 else 0.0
            ppcr = (tp + fp) / float(n_tot)

            data_list.append({
                "seriesId": series_id,
                "cutoff": round(cut, 2),
                "sensitivity": round(sens, 4),
                "specificity": round(spec, 4),
                "ppcr": round(ppcr, 4)
            })

    return {
        "schemaVersion": "2.0",
        "type": "roc",
        "evaluations": eval_list,
        "series": series_list,
        "data": data_list,
        "x": "false_positive_rate",
        "y": "sensitivity",
        "xAxis": { "label": "1 - Specificity", "domain": [0, 1] },
        "yAxis": { "label": "Sensitivity", "domain": [0, 1] },
        "references": [{ "type": "identity", "scope": "global", "label": "Random Guess" }],
        "operatingPoint": { "dimension": "probability_threshold" }
    }

def build_pr_spec(evaluations, eval_obs_map, thresholds):
    eval_list = []
    series_list = []
    data_list = []
    references = []

    pop_seen = set()

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        n_tot = len(obs)
        n_pos = sum(1 for x in obs if x['outcome'] == 1)
        prev = n_pos / float(n_tot)

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        series_id = f"series-{eval_id}"
        role = "population" if ev.get('is_pop_comparison') else "model"
        disp_label = ev['population'] if role == "population" else (ev.get('model') or ev.get('label'))

        series_list.append({
            "id": series_id,
            "evaluationId": eval_id,
            "display": {
                "label": disp_label,
                "group": disp_label,
                "role": role
            }
        })

        if ev['population'] not in pop_seen:
            pop_seen.add(ev['population'])
            references.append({
                "type": "horizontal",
                "value": round(prev, 4),
                "scope": "population",
                "population": ev['population'],
                "label": f"Prevalence ({ev['population']})"
            })

        for cut in thresholds:
            if cut == 0:
                tp = n_pos
                fp = n_tot - n_pos
            else:
                tp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 1)
                fp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 0)

            sens = tp / float(n_pos) if n_pos > 0 else 0.0
            ppv = tp / float(tp + fp) if (tp + fp) > 0 else prev
            ppcr = (tp + fp) / float(n_tot)

            data_list.append({
                "seriesId": series_id,
                "cutoff": round(cut, 2),
                "sensitivity": round(sens, 4),
                "ppv": round(ppv, 4),
                "ppcr": round(ppcr, 4)
            })

    return {
        "schemaVersion": "2.0",
        "type": "precision_recall",
        "evaluations": eval_list,
        "series": series_list,
        "data": data_list,
        "x": "sensitivity",
        "y": "ppv",
        "xAxis": { "label": "Sensitivity", "domain": [0, 1] },
        "yAxis": { "label": "PPV", "domain": [0, 1] },
        "references": references,
        "operatingPoint": { "dimension": "probability_threshold" }
    }

def build_gains_spec(evaluations, eval_obs_map, thresholds):
    eval_list = []
    series_list = []
    data_list = []

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        n_tot = len(obs)
        n_pos = sum(1 for x in obs if x['outcome'] == 1)

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        series_id = f"series-{eval_id}"
        role = "population" if ev.get('is_pop_comparison') else "model"
        disp_label = ev['population'] if role == "population" else (ev.get('model') or ev.get('label'))

        series_list.append({
            "id": series_id,
            "evaluationId": eval_id,
            "display": {
                "label": disp_label,
                "group": disp_label,
                "role": role
            }
        })

        for cut in thresholds:
            if cut == 0:
                tp = n_pos
                fp = n_tot - n_pos
            else:
                tp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 1)
                fp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 0)

            sens = tp / float(n_pos) if n_pos > 0 else 0.0
            ppcr = (tp + fp) / float(n_tot)

            data_list.append({
                "seriesId": series_id,
                "cutoff": round(cut, 2),
                "ppcr": round(ppcr, 4),
                "sensitivity": round(sens, 4)
            })

    return {
        "schemaVersion": "2.0",
        "type": "gains",
        "evaluations": eval_list,
        "series": series_list,
        "data": data_list,
        "x": "ppcr",
        "y": "sensitivity",
        "xAxis": { "label": "Positive Rate (PPCR)", "domain": [0, 1] },
        "yAxis": { "label": "True Positive Rate (Sensitivity)", "domain": [0, 1] },
        "references": [{ "type": "identity", "scope": "global", "label": "Random Guess" }],
        "operatingPoint": { "dimension": "probability_threshold" }
    }

def build_lift_spec(evaluations, eval_obs_map, thresholds):
    eval_list = []
    series_list = []
    data_list = []

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        n_tot = len(obs)
        n_pos = sum(1 for x in obs if x['outcome'] == 1)
        prev = n_pos / float(n_tot)

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        series_id = f"series-{eval_id}"
        role = "population" if ev.get('is_pop_comparison') else "model"
        disp_label = ev['population'] if role == "population" else (ev.get('model') or ev.get('label'))

        series_list.append({
            "id": series_id,
            "evaluationId": eval_id,
            "display": {
                "label": disp_label,
                "group": disp_label,
                "role": role
            }
        })

        for cut in thresholds:
            if cut == 0:
                tp = n_pos
                fp = n_tot - n_pos
            else:
                tp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 1)
                fp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 0)

            ppv = tp / float(tp + fp) if (tp + fp) > 0 else prev
            lift_val = ppv / prev if prev > 0 else 1.0
            ppcr = (tp + fp) / float(n_tot)

            data_list.append({
                "seriesId": series_id,
                "cutoff": round(cut, 2),
                "ppcr": round(ppcr, 4),
                "lift": round(lift_val, 4)
            })

    return {
        "schemaVersion": "2.0",
        "type": "lift",
        "evaluations": eval_list,
        "series": series_list,
        "data": data_list,
        "x": "ppcr",
        "y": "lift",
        "xAxis": { "label": "Positive Rate (PPCR)", "domain": [0, 1] },
        "yAxis": { "label": "Lift" },
        "references": [{ "type": "horizontal", "value": 1.0, "scope": "global", "label": "Baseline Lift (1.0)" }],
        "operatingPoint": { "dimension": "probability_threshold" }
    }

def build_calibration_spec(evaluations, eval_obs_map):
    eval_list = []
    series_list = []
    data_list = []
    dist_list = []

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        series_id = f"series-{eval_id}"
        role = "population" if ev.get('is_pop_comparison') else "model"
        disp_label = ev['population'] if role == "population" else (ev.get('model') or ev.get('label'))

        series_list.append({
            "id": series_id,
            "evaluationId": eval_id,
            "display": {
                "label": disp_label,
                "group": disp_label,
                "role": role
            }
        })

        c_groups = create_calibration_groups(obs, series_id, num_groups=10)
        data_list.extend(c_groups)

        bins = create_score_histogram_bins(obs, eval_id)
        for b in bins:
            if b['lower'] == 0.0 and b['upper'] == 0.0:
                mid = 0.0
                bw = 0.005
            else:
                mid = round((b['lower'] + b['upper']) / 2.0, 4)
                bw = round(b['upper'] - b['lower'], 4)
            cnt = b['nPositive'] + b['nNegative']
            dist_list.append({
                "seriesId": series_id,
                "midpoint": mid,
                "count": cnt,
                "binWidth": bw
            })

    return {
        "schemaVersion": "2.0",
        "type": "calibration",
        "evaluations": eval_list,
        "series": series_list,
        "data": data_list,
        "distribution": dist_list,
        "x": "predicted",
        "y": "observed",
        "xAxis": { "label": "Predicted Probability", "domain": [0, 1] },
        "yAxis": { "label": "Observed Proportion", "domain": [0, 1] },
        "references": [{ "type": "identity", "scope": "global", "label": "Perfectly Calibrated" }]
    }

def build_pred_dist_spec(evaluations, eval_obs_map, title):
    eval_list = []
    all_bins = []
    all_rank_bins = []
    all_ops = []

    grid = [round(i * 0.01, 2) for i in range(101)]

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        bins = create_score_histogram_bins(obs, eval_id)
        rank_bins = create_producer_rank_bins(obs, eval_id, 0.01)
        ops = calculate_producer_ops(obs, eval_id, bins, grid, grid)

        all_bins.extend(bins)
        all_rank_bins.extend(rank_bins)
        all_ops.extend(ops)

    return {
        "schemaVersion": "2.0",
        "type": "prediction_distribution",
        "title": title,
        "evaluations": eval_list,
        "operatingPoint": { "dimension": "probability_threshold" },
        "bins": all_bins,
        "rankBins": all_rank_bins,
        "operatingPoints": all_ops
    }

def build_summary_metrics_spec(evaluations, eval_obs_map):
    pops_dict = {}
    eval_list = []
    metrics_list = []

    for ev in evaluations:
        pop_id = f"pop-{ev['population'].lower()}"
        if pop_id not in pops_dict:
            pops_dict[pop_id] = ev['population']

        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        auroc_val = calculate_auroc(obs)

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model') or "Model A",
            "population": ev['population']
        })

        metrics_list.append({
            "metric": "auroc",
            "owner": { "type": "evaluation", "evaluationId": eval_id },
            "estimate": auroc_val
        })

    pop_list = [{"id": pid, "label": plabel} for pid, plabel in pops_dict.items()]

    for pop_id, plabel in pops_dict.items():
        matching_obs = None
        for ev in evaluations:
            if ev['population'] == plabel:
                matching_obs = eval_obs_map[ev['id']]
                break
        if matching_obs:
            tot = len(matching_obs)
            pos = sum(1 for x in matching_obs if x['outcome'] == 1)
            prev = pos / float(tot) if tot > 0 else 0.0
            metrics_list.append({
                "metric": "prevalence",
                "owner": { "type": "population", "populationId": pop_id },
                "estimate": round(prev, 4)
            })

    return {
        "schemaVersion": "1.0",
        "type": "summary_metrics",
        "title": "Model Performance & Prevalence Summary",
        "populations": pop_list,
        "evaluations": eval_list,
        "metrics": metrics_list
    }

def build_performance_table_spec(evaluations, eval_obs_map, selected_cutoffs=[0.2, 0.5, 0.8]):
    eval_list = []
    rows_list = []

    metrics_list = [
        {"id": "sensitivity", "label": "Sensitivity"},
        {"id": "specificity", "label": "Specificity"},
        {"id": "ppv", "label": "PPV"},
        {"id": "npv", "label": "NPV"},
        {"id": "lift", "label": "Lift"}
    ]

    for ev in evaluations:
        eval_id = ev['id']
        obs = eval_obs_map[eval_id]
        n_tot = len(obs)
        n_pos = sum(1 for x in obs if x['outcome'] == 1)
        n_neg = n_tot - n_pos
        prev = n_pos / float(n_tot) if n_tot > 0 else 0.1

        eval_list.append({
            "id": eval_id,
            "model": ev.get('model'),
            "population": ev['population'],
            "label": ev.get('label', eval_id)
        })

        for cut in selected_cutoffs:
            if cut == 0:
                tp, fp = n_pos, n_neg
            else:
                tp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 1)
                fp = sum(1 for x in obs if x['score'] > cut and x['outcome'] == 0)

            fn = n_pos - tp
            tn = n_neg - fp

            sens = tp / float(n_pos) if n_pos > 0 else 0.0
            spec = tn / float(n_neg) if n_neg > 0 else 0.0
            ppv = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
            npv = tn / float(tn + fn) if (tn + fn) > 0 else 0.0
            lift_val = ppv / prev if prev > 0 else 1.0

            rows_list.append({
                "evaluationId": eval_id,
                "operatingPoint": {
                    "type": "probability_threshold",
                    "value": round(cut, 2),
                    "cutoff": round(cut, 2)
                },
                "values": [
                    {"metricId": "sensitivity", "estimate": round(sens, 4)},
                    {"metricId": "specificity", "estimate": round(spec, 4)},
                    {"metricId": "ppv", "estimate": round(ppv, 4)},
                    {"metricId": "npv", "estimate": round(npv, 4)},
                    {"metricId": "lift", "estimate": round(lift_val, 4)}
                ]
            })

    return {
        "schemaVersion": "2.0",
        "type": "performance_table",
        "title": "Performance Summary Table",
        "evaluations": eval_list,
        "metrics": metrics_list,
        "rows": rows_list
    }

def generate_all_demo_fixtures(target_dir="fixtures/v2/demo"):
    os.makedirs(target_dir, exist_ok=True)

    # 1. Generate observation sets for the 3 reports
    obs_a_test, obs_b_test = generate_paired_test_observations(3000, seed=42)
    obs_a_train = generate_individual_observations(5000, 'high', seed=1001)
    obs_a_val = generate_individual_observations(2000, 'high_val', seed=2002)

    grid_101 = [round(i * 0.01, 2) for i in range(101)]

    # --- REPORT 1: One Model, One Population ---
    evals_r1 = [
        {"id": "Model A - Test", "model": "Model A", "population": "Test", "label": "Model A — Test"}
    ]
    obs_r1 = {"Model A - Test": obs_a_test}

    roc_r1 = build_roc_spec(evals_r1, obs_r1, grid_101)
    pr_r1 = build_pr_spec(evals_r1, obs_r1, grid_101)
    gains_r1 = build_gains_spec(evals_r1, obs_r1, grid_101)
    lift_r1 = build_lift_spec(evals_r1, obs_r1, grid_101)
    calib_r1 = build_calibration_spec(evals_r1, obs_r1)
    pred_dist_r1 = build_pred_dist_spec(evals_r1, obs_r1, "Prediction Distribution — Model A (Test)")
    summary_metrics_r1 = build_summary_metrics_spec(evals_r1, obs_r1)
    perf_table_r1 = build_performance_table_spec(evals_r1, obs_r1)

    # --- REPORT 2: Several Models, One Population ---
    evals_r2 = [
        {"id": "Model A - Test", "model": "Model A", "population": "Test", "label": "Model A — Test"},
        {"id": "Model B - Test", "model": "Model B", "population": "Test", "label": "Model B — Test"}
    ]
    obs_r2 = {
        "Model A - Test": obs_a_test,
        "Model B - Test": obs_b_test
    }

    roc_r2 = build_roc_spec(evals_r2, obs_r2, grid_101)
    pr_r2 = build_pr_spec(evals_r2, obs_r2, grid_101)
    gains_r2 = build_gains_spec(evals_r2, obs_r2, grid_101)
    lift_r2 = build_lift_spec(evals_r2, obs_r2, grid_101)
    calib_r2 = build_calibration_spec(evals_r2, obs_r2)
    pred_dist_r2 = build_pred_dist_spec(evals_r2, obs_r2, "Prediction Distribution — Model Comparison (Test)")
    summary_metrics_r2 = build_summary_metrics_spec(evals_r2, obs_r2)
    perf_table_r2 = build_performance_table_spec(evals_r2, obs_r2)

    # --- REPORT 3: One Model, Several Populations ---
    evals_r3 = [
        {"id": "Model A - Train", "model": "Model A", "population": "Train", "label": "Model A — Train", "is_pop_comparison": True},
        {"id": "Model A - Test", "model": "Model A", "population": "Test", "label": "Model A — Test", "is_pop_comparison": True},
        {"id": "Model A - Validation", "model": "Model A", "population": "Validation", "label": "Model A — Validation", "is_pop_comparison": True}
    ]
    obs_r3 = {
        "Model A - Train": obs_a_train,
        "Model A - Test": obs_a_test,
        "Model A - Validation": obs_a_val
    }

    roc_r3 = build_roc_spec(evals_r3, obs_r3, grid_101)
    pr_r3 = build_pr_spec(evals_r3, obs_r3, grid_101)
    gains_r3 = build_gains_spec(evals_r3, obs_r3, grid_101)
    lift_r3 = build_lift_spec(evals_r3, obs_r3, grid_101)
    calib_r3 = build_calibration_spec(evals_r3, obs_r3)
    pred_dist_r3 = build_pred_dist_spec(evals_r3, obs_r3, "Prediction Distribution — Model A across Populations")
    summary_metrics_r3 = build_summary_metrics_spec(evals_r3, obs_r3)
    perf_table_r3 = build_performance_table_spec(evals_r3, obs_r3)

    # Save canonical standalone component specifications to target_dir
    fixtures_to_save = {
        os.path.join(target_dir, "model-a-test-roc.json"): roc_r1,
        os.path.join(target_dir, "model-a-test-calibration.json"): calib_r1,
        os.path.join(target_dir, "model-a-test-precision-recall.json"): pr_r1,
        os.path.join(target_dir, "model-a-test-gains.json"): gains_r1,
        os.path.join(target_dir, "model-a-test-lift.json"): lift_r1,
        os.path.join(target_dir, "model-a-test-prediction-distribution.json"): pred_dist_r1,
        os.path.join(target_dir, "model-a-test-summary-metrics.json"): summary_metrics_r1,
        os.path.join(target_dir, "model-a-test-performance-table.json"): perf_table_r1,

        os.path.join(target_dir, "models-a-b-test-roc.json"): roc_r2,
        os.path.join(target_dir, "models-a-b-test-calibration.json"): calib_r2,
        os.path.join(target_dir, "models-a-b-test-precision-recall.json"): pr_r2,
        os.path.join(target_dir, "models-a-b-test-gains.json"): gains_r2,
        os.path.join(target_dir, "models-a-b-test-lift.json"): lift_r2,
        os.path.join(target_dir, "models-a-b-test-prediction-distribution.json"): pred_dist_r2,
        os.path.join(target_dir, "models-a-b-test-summary-metrics.json"): summary_metrics_r2,
        os.path.join(target_dir, "models-a-b-test-performance-table.json"): perf_table_r2,

        os.path.join(target_dir, "model-a-train-test-val-roc.json"): roc_r3,
        os.path.join(target_dir, "model-a-train-test-val-calibration.json"): calib_r3,
        os.path.join(target_dir, "model-a-train-test-val-precision-recall.json"): pr_r3,
        os.path.join(target_dir, "model-a-train-test-val-gains.json"): gains_r3,
        os.path.join(target_dir, "model-a-train-test-val-lift.json"): lift_r3,
        os.path.join(target_dir, "model-a-train-test-val-prediction-distribution.json"): pred_dist_r3,
        os.path.join(target_dir, "model-a-train-test-val-summary-metrics.json"): summary_metrics_r3,
        os.path.join(target_dir, "model-a-train-test-val-performance-table.json"): perf_table_r3,
    }

    for path, data in fixtures_to_save.items():
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    print(f"Successfully generated all demo fixtures under {target_dir}")

if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "fixtures/v2/demo"
    generate_all_demo_fixtures(out_dir)
