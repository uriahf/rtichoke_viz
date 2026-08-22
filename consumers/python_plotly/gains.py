from __future__ import annotations

from typing import Any

import plotly.graph_objects as go

from render import group_colors, series_specs


def reference_points(ref: dict[str, Any]) -> tuple[list[float], list[float]] | None:
    if ref.get("type") == "identity":
        return [0, 1], [0, 1]
    if ref.get("type") == "path" and ref.get("points"):
        return ([point["x"] for point in ref["points"]], [point["y"] for point in ref["points"]])
    return None


def render_gains(spec: dict[str, Any]) -> go.Figure:
    series = series_specs(spec)
    groups = list(dict.fromkeys(item["display"]["group"] for item in spec["series"]))
    colors = group_colors(groups)
    fig = go.Figure()

    for ref in spec.get("references", []):
        points = reference_points(ref)
        if points is None:
            continue
        x, y = points
        fig.add_trace(go.Scatter(
            x=x, y=y, mode="lines", name=ref.get("label", "Reference"),
            line={"color": "#BEBEBE", "width": 2, "dash": "dot"},
            hovertemplate=f'{ref.get("label", "Reference")}<extra></extra>',
            showlegend=False,
        ))

    for series_id, item in series.items():
        rows = [row for row in spec["data"] if row["seriesId"] == series_id]
        if not rows:
            continue
        display = item["display"]
        fig.add_trace(go.Scatter(
            x=[row["ppcr"] for row in rows],
            y=[row["sensitivity"] for row in rows],
            mode="lines",
            name=display["label"],
            legendgroup=display["group"],
            line={"color": colors[display["group"]], "width": 2},
            customdata=[[row["cutoff"]] for row in rows],
            hovertemplate="Cutoff: %{customdata[0]:.3f}<br>PPCR: %{x:.3f}<br>Sensitivity: %{y:.3f}<extra></extra>",
            showlegend=len(series) > 1,
        ))

    fig.update_layout(width=600, height=600, plot_bgcolor="white", paper_bgcolor="white")
    fig.update_xaxes(title=spec["xAxis"]["label"], range=spec["xAxis"]["domain"], showgrid=False)
    fig.update_yaxes(title=spec["yAxis"]["label"], range=spec["yAxis"]["domain"], showgrid=False)
    return fig
