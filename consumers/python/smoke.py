from renderers import read_rtichoke_spec, render_calibration_plotly, render_roc_plotly

roc = read_rtichoke_spec("fixtures/roc.json")
calibration = read_rtichoke_spec("fixtures/calibration.json")

roc_fig = render_roc_plotly(roc)
calibration_fig = render_calibration_plotly(calibration)

assert len(roc_fig.data) >= 2
assert len(calibration_fig.data) >= 2
assert roc_fig.layout.xaxis.title.text == "1 - Specificity"
assert calibration_fig.layout.xaxis.title.text == "Predicted probability"

print("Python Plotly consumer accepted canonical ROC and calibration specs")
