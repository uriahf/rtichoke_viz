from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import plotly.graph_objects as go
from plotly.subplots import make_subplots

RTICHOKE_COLORS = [
    "#1b9e77",
    "#d95f02",
    "#7570b3",
    "#e7298a",
    "#07004D",
    "#E6AB02",
    "#FE5F55",
    "#54494B",
    "#006E90",
    "#BC96E6",
]


def load_spec(path: Path) -> dict[str, Any]:
    spec = json.loads(path.read_text())
    if spec.get("schemaVersion") != "1.0":
        raise ValueError("unsupported schemaVersion")
    if spec.get("type") not in {"roc", "calibration"}:
        raise ValueError("unsupported chart type")
    return spec


def model_colors(models: list[str]) -> dict[str, str]:
    if len(models) == 1:
        return {models[0]: "black"}
    return {model: RTICHOKE_COLORS[i % len(RTICHOKE_COLORS)] for i, model in enumerate(models)}


def render_roc(spec: dict[str, Any]) -> go.Figure:
    models = list(dict.fromkeys(row["model"] for row in spec["data"]))
    colors = model_colors(models)
    fig = go.Figure()

    for model in models:
        rows = [row for row in spec["data"] if row["model"] == model]
        fig.add_trace(
            go.Scatter(
                x=[1 - row["specificity"] for row in rows],
                y=[row["sensitivity"] for row in rows],
                mode="lines",
                name=model,
                line={"color": colors[model], "width": 2},
                customdata=[[row["cutoff"], row["specificity"]] for row in rows],
                hovertemplate=(
                    "Cutoff: %{customdata[0]:.3f}<br>"
                    "Sensitivity: %{y:.3f}<br>Specificity: %{customdata[1]:.3f}<extra></extra>"
                ),
                showlegend=len(models) > 1,
            )
        )

    if any(ref.get("type") == "identity" for ref in spec.get("references", [])):
        fig.add_trace(
            go.Scatter(
                x=[0, 1],
                y=[0, 1],
                mode="lines",
                line={"color": "#BEBEBE", "width": 2},
                hovertemplate="Random Guess<extra></extra>",
                showlegend=False,
            )
        )

    fig.update_layout(
        width=600,
        height=600,
        plot_bgcolor="white",
        paper_bgcolor="white",
        margin={"l": 65, "r": 30, "t": 35, "b": 60},
        legend={"orientation": "h", "x": 0.5, "xanchor": "center", "y": 1.08},
    )
    fig.update_xaxes(title=spec["xAxis"]["label"], range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False)
    return fig


def calibration_hover(row: dict[str, Any]) -> str:
    text = "Predicted: %{x:.3f}<br>Observed: %{y:.3f}"
    if row.get("events") is not None and row.get("total") is not None:
        text += f" ({row['events']} / {row['total']})"
    return text + "<extra></extra>"


def render_calibration(spec: dict[str, Any]) -> go.Figure:
    distribution = spec.get("distribution", [])
    has_distribution = bool(distribution)
    models = list(dict.fromkeys(row["model"] for row in spec["data"]))
    colors = model_colors(models)

    if has_distribution:
        fig = make_subplots(
            rows=2,
            cols=1,
            shared_xaxes=True,
            row_heights=[0.8, 0.2],
            vertical_spacing=0.03,
        )
    else:
        fig = make_subplots(rows=1, cols=1)

    if any(ref.get("type") == "identity" for ref in spec.get("references", [])):
        fig.add_trace(
            go.Scatter(
                x=[0, 1],
                y=[0, 1],
                mode="lines",
                line={"color": "#BEBEBE", "width": 2, "dash": "dot"},
                hovertemplate="Perfectly Calibrated<extra></extra>",
                showlegend=False,
            ),
            row=1,
            col=1,
        )

    for model in models:
        rows = [row for row in spec["data"] if row["model"] == model]
        discrete = any(row["method"] == "discrete" for row in rows)
        first = rows[0]
        fig.add_trace(
            go.Scatter(
                x=[row["predicted"] for row in rows],
                y=[row["observed"] for row in rows],
                mode="lines+markers" if discrete else "lines",
                marker={"size": 10, "color": colors[model]},
                line={"color": colors[model], "width": 2},
                name=model,
                showlegend=len(models) > 1,
                customdata=[
                    [row.get("events"), row.get("total")]
                    for row in rows
                ],
                hovertemplate=calibration_hover(first),
            ),
            row=1,
            col=1,
        )

    if has_distribution:
        opacity = 1 / max(len(models), 1)
        for model in models:
            rows = [row for row in distribution if row["model"] == model]
            if not rows:
                continue
            fig.add_trace(
                go.Bar(
                    x=[row["midpoint"] for row in rows],
                    y=[row["count"] for row in rows],
                    width=[row["binWidth"] for row in rows],
                    marker={"color": colors[model]},
                    opacity=opacity,
                    name=model,
                    legendgroup=model,
                    showlegend=False,
                    customdata=[
                        [row["midpoint"] - row["binWidth"] / 2, row["midpoint"] + row["binWidth"] / 2]
                        for row in rows
                    ],
                    hovertemplate=(
                        "%{y} observations in [%{customdata[0]:.3f}, %{customdata[1]:.3f}]"
                        "<extra></extra>"
                    ),
                ),
                row=2,
                col=1,
            )

    fig.update_layout(
        width=600,
        height=600,
        barmode="overlay",
        plot_bgcolor="white",
        paper_bgcolor="white",
        margin={"l": 65, "r": 30, "t": 35, "b": 60},
        legend={"orientation": "h", "x": 0.5, "xanchor": "center", "y": 1.08},
    )
    fig.update_xaxes(range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False, row=1, col=1)
    fig.update_xaxes(title=spec["xAxis"]["label"], row=2 if has_distribution else 1, col=1)
    if has_distribution:
        fig.update_yaxes(title=None, showgrid=False, row=2, col=1)
    return fig


def render(spec: dict[str, Any]) -> go.Figure:
    if spec["type"] == "roc":
        return render_roc(spec)
    return render_calibration(spec)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, default=Path("fixtures"))
    parser.add_argument("--output", type=Path, default=Path("site/python-plotly"))
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    for chart in ("roc", "calibration"):
        spec = load_spec(args.fixtures / f"{chart}.json")
        figure = render(spec)
        figure.write_html(
            args.output / f"{chart}.html",
            include_plotlyjs=True,
            full_html=True,
            config={"displayModeBar": False},
        )


if __name__ == "__main__":
    main()
