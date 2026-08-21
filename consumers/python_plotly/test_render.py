import copy
import json
import unittest
from pathlib import Path

from render import render_calibration


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

        self.assertEqual(len(line_traces), 2)  # identity + calibration curve
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


if __name__ == "__main__":
    unittest.main()
