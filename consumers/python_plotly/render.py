from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import plotly.graph_objects as go
from plotly.subplots import make_subplots

RTICHOKE_COLORS = [
    "#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#07004D",
    "#E6AB02", "#FE5F55", "#54494B", "#006E90", "#BC96E6",
]


def load_spec(path: Path) -> dict[str, Any]:
    spec = json.loads(path.read_text())
    if spec.get("schemaVersion") != "2.0":
        raise ValueError("unsupported schemaVersion")
    if spec.get("type") not in {"roc", "calibration", "precision_recall"}:
        raise ValueError("unsupported chart type")
    return spec


def series_groups(spec: dict[str, Any]) -> dict[str, str]:
    return {series["id"]: series["display"]["group"] for series in spec["series"]}


def group_colors(groups: list[str]) -> dict[str, str]:
    if len(groups) == 1:
        return {groups[0]: "black"}
    return {group: RTICHOKE_COLORS[i % len(RTICHOKE_COLORS)] for i, group in enumerate(groups)}


def render_roc(spec: dict[str, Any]) -> go.Figure:
    mapping = series_groups(spec)
    groups = list(dict.fromkeys(mapping[row["seriesId"]] for row in spec["data"]))
    colors = group_colors(groups)
    fig = go.Figure()
    for group in groups:
        rows = [row for row in spec["data"] if mapping[row["seriesId"]] == group]
        fig.add_trace(go.Scatter(
            x=[1 - row["specificity"] for row in rows],
            y=[row["sensitivity"] for row in rows],
            mode="lines",
            name=group,
            line={"color": colors[group], "width": 2},
            customdata=[[row["cutoff"], row["specificity"]] for row in rows],
            hovertemplate="Cutoff: %{customdata[0]:.3f}<br>Sensitivity: %{y:.3f}<br>Specificity: %{customdata[1]:.3f}<extra></extra>",
            showlegend=len(groups) > 1,
        ))
    if any(ref.get("type") == "identity" for ref in spec.get("references", [])):
        fig.add_trace(go.Scatter(
            x=[0, 1], y=[0, 1], mode="lines",
            line={"color": "#BEBEBE", "width": 2},
            hovertemplate="Random Guess<extra></extra>", showlegend=False,
        ))
    fig.update_layout(width=600, height=600, plot_bgcolor="white", paper_bgcolor="white")
    fig.update_xaxes(title=spec["xAxis"]["label"], range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False)
    return fig


def calibration_hover(rows: list[dict[str, Any]]) -> str:
    text = "Predicted: %{x:.3f}<br>Observed: %{y:.3f}"
    if any(row.get("events") is not None and row.get("total") is not None for row in rows):
        text += " (%{customdata[0]} / %{customdata[1]})"
    return text + "<extra></extra>"


def render_calibration(spec: dict[str, Any]) -> go.Figure:
    mapping = series_groups(spec)
    distribution = spec.get("distribution", [])
    groups = list(dict.fromkeys(mapping[row["seriesId"]] for row in spec["data"]))
    colors = group_colors(groups)
    has_distribution = bool(distribution)
    fig = make_subplots(rows=2 if has_distribution else 1, cols=1, shared_xaxes=has_distribution,
                        row_heights=[0.8, 0.2] if has_distribution else None)
    if any(ref.get("type") == "identity" for ref in spec.get("references", [])):
        fig.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines",
                                 line={"color": "#BEBEBE", "width": 2, "dash": "dot"},
                                 hovertemplate="Perfectly Calibrated<extra></extra>", showlegend=False), row=1, col=1)
    for group in groups:
        rows = [row for row in spec["data"] if mapping[row["seriesId"]] == group]
        discrete = any(row["method"] == "discrete" for row in rows)
        fig.add_trace(go.Scatter(
            x=[row["predicted"] for row in rows], y=[row["observed"] for row in rows],
            mode="lines+markers" if discrete else "lines", name=group,
            marker={"size": 10, "color": colors[group]}, line={"color": colors[group], "width": 2},
            showlegend=len(groups) > 1,
            customdata=[[row.get("events"), row.get("total")] for row in rows],
            hovertemplate=calibration_hover(rows),
        ), row=1, col=1)
    if has_distribution:
        for group in groups:
            rows = [row for row in distribution if mapping[row["seriesId"]] == group]
            if not rows:
                continue
            fig.add_trace(go.Bar(
                x=[row["midpoint"] for row in rows], y=[row["count"] for row in rows],
                width=[row["binWidth"] for row in rows], marker={"color": colors[group]},
                opacity=1 / max(len(groups), 1), name=group, showlegend=False,
            ), row=2, col=1)
    fig.update_layout(width=600, height=600, barmode="overlay", plot_bgcolor="white", paper_bgcolor="white")
    fig.update_xaxes(range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False, row=1, col=1)
    fig.update_xaxes(title=spec["xAxis"]["label"], row=2 if has_distribution else 1, col=1)
    return fig


def render_precision_recall(spec: dict[str, Any]) -> go.Figure:
    mapping = series_groups(spec)
    groups = list(dict.fromkeys(mapping[row["seriesId"]] for row in spec["data"]))
    colors = group_colors(groups)
    fig = go.Figure()
    for ref in spec.get("references", []):
        if ref.get("type") == "horizontal" and ref.get("value") is not None:
            fig.add_hline(y=ref["value"], line={"color": "#BEBEBE", "width": 2, "dash": "dot"})
    for group in groups:
        rows = [row for row in spec["data"] if mapping[row["seriesId"]] == group]
        fig.add_trace(go.Scatter(
            x=[row["sensitivity"] for row in rows],
            y=[row["ppv"] for row in rows],
            mode="lines",
            name=group,
            line={"color": colors[group], "width": 2},
            customdata=[[row["cutoff"]] for row in rows],
            hovertemplate="Cutoff: %{customdata[0]:.3f}<br>Sensitivity: %{x:.3f}<br>PPV: %{y:.3f}<extra></extra>",
            showlegend=len(groups) > 1,
        ))
    fig.update_layout(width=600, height=600, plot_bgcolor="white", paper_bgcolor="white")
    fig.update_xaxes(title=spec["xAxis"]["label"], range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False)
    return fig


def render(spec: dict[str, Any]) -> go.Figure:
    if spec["type"] == "roc":
        return render_roc(spec)
    if spec["type"] == "calibration":
        return render_calibration(spec)
    return render_precision_recall(spec)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, default=Path("fixtures/v2"))
    parser.add_argument("--output", type=Path, default=Path("site/python-plotly"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixtures = {
        "roc": "roc.json",
        "calibration": "calibration.json",
        "precision-recall": "precision-recall-shared-population.json",
    }
    for chart, filename in fixtures.items():
        spec = load_spec(args.fixtures / filename)
        render(spec).write_html(args.output / f"{chart}.html", include_plotlyjs=True, full_html=True,
                                config={"displayModeBar": False})


if __name__ == "__main__":
    main()
