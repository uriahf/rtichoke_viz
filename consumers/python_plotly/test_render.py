import copy
import json
import unittest
from pathlib import Path

from gains import render_gains
from render import render_calibration, scale_calibration_for_demo


class CalibrationRendererTest(unittest.TestCase):
    def test_mixed_methods_mark_only_discrete_rows(self) -> None:
        spec = json.loads(Path("fixtures/v2/calibration.json").read_text())
        mixed = copy.deepcopy(spec)
        mixed["data"][0]["method"] = "smooth"
        mixed["data"][1]["method"] = "discrete"
        mixed["data"][2]["method"] = "smooth"
        fig = render_calibration(mixed)
        line_traces = [trace for trace in fig.data if getattr(trace, "mode", None) == "lines"]
        marker_traces = [trace for trace in fig.data if getattr(trace, "mode", None) == "markers"]
        self.assertEqual(len(line_traces), 2)
        self.assertEqual(len(marker_traces), 1)
        self.assertEqual(list(marker_traces[0].x), [0.4])
        self.assertEqual(list(marker_traces[0].y), [0.36])

    def test_distribution_is_rendered_from_supplied_bins(self) -> None:
        spec = json.loads(Path("fixtures/v2/calibration.json").read_text())
        fig = render_calibration(spec)
        bars = [trace for trace in fig.data if trace.type == "bar"]
        self.assertEqual(len(bars), 1)
        self.assertEqual(list(bars[0].x), [0.1, 0.4, 0.8])
        self.assertEqual(list(bars[0].y), [20, 45, 35])
        self.assertEqual(list(bars[0].width), [0.1, 0.1, 0.1])

    def test_scale_calibration_for_demo(self) -> None:
        spec = json.loads(Path("fixtures/v2/calibration.json").read_text())
        scaled = scale_calibration_for_demo(spec)
        total_distribution_count = sum(bin_item["count"] for bin_item in scaled["distribution"])
        self.assertEqual(total_distribution_count, 1000)

        expected_events = {(row["seriesId"], row["predicted"]): row for row in [
            {"seriesId": "series-pop-a", "predicted": 0.1, "total": 200, "events": 16},
            {"seriesId": "series-pop-a", "predicted": 0.4, "total": 450, "events": 162},
            {"seriesId": "series-pop-a", "predicted": 0.8, "total": 350, "events": 266},
        ]}

        for row in scaled["data"]:
            if row.get("method") == "discrete":
                matching_bin = next(
                    bin_item for bin_item in scaled["distribution"]
                    if bin_item["seriesId"] == row["seriesId"] and bin_item["midpoint"] == row["predicted"]
                )
                self.assertEqual(row["total"], matching_bin["count"])
                expected = expected_events[(row["seriesId"], row["predicted"])]
                self.assertEqual(row["total"], expected["total"])
                self.assertEqual(row["events"], expected["events"])

    def test_scale_calibration_for_demo_multi_population_cross_language_rounding(self) -> None:
        spec = json.loads(Path("fixtures/v2/calibration-populations.json").read_text())
        scaled = scale_calibration_for_demo(spec)

        for series_id in ["series-pop-a", "series-pop-b"]:
            sum_count = sum(b["count"] for b in scaled["distribution"] if b["seriesId"] == series_id)
            self.assertEqual(sum_count, 1000)

        # Assert cross-language Math.round behavior explicitly:
        # For series-pop-b at predicted = 0.4: observed = 0.43, total = 350.
        # 0.43 * 350 = 150.5. JS Math.round(150.5) is 151 (whereas Python round(150.5) ties-to-even is 150).
        pop_b_04 = next(
            row for row in scaled["data"]
            if row["seriesId"] == "series-pop-b" and row["predicted"] == 0.4
        )
        self.assertEqual(pop_b_04["total"], 350)
        self.assertEqual(pop_b_04["events"], 151)

        expected_rows = {
            ("series-pop-a", 0.1): (200, 16),
            ("series-pop-a", 0.4): (450, 162),
            ("series-pop-a", 0.8): (350, 266),
            ("series-pop-b", 0.1): (300, 36),
            ("series-pop-b", 0.4): (350, 151),
            ("series-pop-b", 0.8): (350, 294),
        }

        for row in scaled["data"]:
            if row.get("method") == "discrete":
                matching_bin = next(
                    bin_item for bin_item in scaled["distribution"]
                    if bin_item["seriesId"] == row["seriesId"] and bin_item["midpoint"] == row["predicted"]
                )
                self.assertEqual(row["total"], matching_bin["count"])
                exp_total, exp_events = expected_rows[(row["seriesId"], row["predicted"])]
                self.assertEqual(row["total"], exp_total)
                self.assertEqual(row["events"], exp_events)


class GainsRendererTest(unittest.TestCase):
    def test_renders_model_series_and_supplied_reference_paths(self) -> None:
        spec = json.loads(Path("fixtures/v2/gains-shared-population.json").read_text())
        fig = render_gains(spec)
        model_traces = [trace for trace in fig.data if trace.legendgroup is not None]
        reference_traces = {
            trace.name: trace for trace in fig.data if trace.legendgroup is None
        }
        self.assertEqual(len(model_traces), 2)
        self.assertEqual([trace.name for trace in model_traces], ["Model A", "Model B"])
        self.assertEqual(set(reference_traces), {"Random", "Perfect Model"})
        self.assertEqual(list(reference_traces["Random"].x), [0, 1])

        perfect_spec = next(
            reference for reference in spec["references"] if reference["label"] == "Perfect Model"
        )
        self.assertEqual(
            list(reference_traces["Perfect Model"].x),
            [point["x"] for point in perfect_spec["points"]],
        )
        self.assertEqual(
            list(reference_traces["Perfect Model"].y),
            [point["y"] for point in perfect_spec["points"]],
        )


if __name__ == "__main__":
    unittest.main()
