import json
from pathlib import Path

import plotly.graph_objects as go

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


def read_rtichoke_spec(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


def render_roc_plotly(spec: dict) -> go.Figure:
    fig = go.Figure()
    models = list(dict.fromkeys(row["model"] for row in spec["data"]))
    for i, model in enumerate(models):
        rows = [row for row in spec["data"] if row["model"] == model]
        fig.add_trace(
            go.Scatter(
                x=[1 - row["specificity"] for row in rows],
                y=[row["sensitivity"] for row in rows],
                mode="lines",
                name=model,
                line={"color": RTICHOKE_COLORS[i % len(RTICHOKE_COLORS)]},
            )
        )
    if any(ref["type"] == "identity" for ref in spec.get("references", [])):
        fig.add_trace(
            go.Scatter(
                x=[0, 1], y=[0, 1], mode="lines", showlegend=False,
                line={"color": "grey"}, name="Random Guess",
            )
        )
    fig.update_layout(
        xaxis={"title": spec["xAxis"]["label"], "range": spec["xAxis"]["domain"], "showgrid": False},
        yaxis={"title": spec["yAxis"]["label"], "range": spec["yAxis"]["domain"], "showgrid": False},
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def render_calibration_plotly(spec: dict) -> go.Figure:
    fig = go.Figure()
    models = list(dict.fromkeys(row["model"] for row in spec["data"]))
    one_model = len(models) == 1
    for i, model in enumerate(models):
        rows = [row for row in spec["data"] if row["model"] == model]
        mode = "lines+markers" if any(row["method"] == "discrete" for row in rows) else "lines"
        color = "black" if one_model else RTICHOKE_COLORS[i % len(RTICHOKE_COLORS)]
        fig.add_trace(
            go.Scatter(
                x=[row["predicted"] for row in rows],
                y=[row["observed"] for row in rows],
                mode=mode,
                name=model,
                showlegend=not one_model,
                line={"color": color},
                marker={"color": color},
            )
        )
    if any(ref["type"] == "identity" for ref in spec.get("references", [])):
        fig.add_trace(
            go.Scatter(
                x=[0, 1], y=[0, 1], mode="lines", showlegend=False,
                line={"color": "grey", "dash": "dash"}, name="Perfectly Calibrated",
            )
        )
    fig.update_layout(
        xaxis={"title": spec["xAxis"]["label"], "range": spec["xAxis"]["domain"], "showgrid": False},
        yaxis={"title": spec["yAxis"]["label"], "range": spec["yAxis"]["domain"], "showgrid": False},
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig
