source("consumers/R/renderers.R")
library(htmlwidgets)

roc <- read_rtichoke_spec("fixtures/v2/roc.json")
calibration <- read_rtichoke_spec("fixtures/v2/calibration.json")

roc_gg <- render_roc_ggplot(roc)
roc_plotly <- render_roc_plotly(roc)
calibration_gg <- render_calibration_ggplot(calibration)
calibration_plotly <- render_calibration_plotly(calibration)

stopifnot(inherits(roc_gg, "ggplot"))
stopifnot(inherits(calibration_gg, "ggplot"))
stopifnot(inherits(roc_plotly, "plotly"))
stopifnot(inherits(calibration_plotly, "plotly"))
stopifnot(identical(roc$schemaVersion, "2.0"))
stopifnot(identical(calibration$schemaVersion, "2.0"))

out_dir <- "site/r-consumers"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

ggsave(file.path(out_dir, "roc-ggplot.png"), roc_gg, width = 6, height = 6, dpi = 120)
ggsave(file.path(out_dir, "calibration-ggplot.png"), calibration_gg, width = 6, height = 6, dpi = 120)

saveWidget(roc_plotly, file.path(out_dir, "roc-plotly.html"), selfcontained = FALSE)
saveWidget(calibration_plotly, file.path(out_dir, "calibration-plotly.html"), selfcontained = FALSE)

cat("R ggplot2 + Plotly consumers rendered canonical v2 ROC and calibration specs\n")
