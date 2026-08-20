source("consumers/R/renderers.R")

roc <- read_rtichoke_spec("fixtures/roc.json")
calibration <- read_rtichoke_spec("fixtures/calibration.json")

roc_gg <- render_roc_ggplot(roc)
roc_plotly <- render_roc_plotly(roc)
calibration_gg <- render_calibration_ggplot(calibration)
calibration_plotly <- render_calibration_plotly(calibration)

stopifnot(inherits(roc_gg, "ggplot"))
stopifnot(inherits(calibration_gg, "ggplot"))
stopifnot(inherits(roc_plotly, "plotly"))
stopifnot(inherits(calibration_plotly, "plotly"))
stopifnot(identical(roc$xAxis$label, "1 - Specificity"))
stopifnot(identical(calibration$xAxis$label, "Predicted probability"))

cat("R ggplot2 + Plotly consumers accepted canonical ROC and calibration specs\n")
