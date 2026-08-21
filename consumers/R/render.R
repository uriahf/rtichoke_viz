source("consumers/R/renderers.R")
library(htmlwidgets)

roc <- read_rtichoke_spec("fixtures/v2/roc.json")
calibration <- read_rtichoke_spec("fixtures/v2/calibration.json")
precision_recall <- read_rtichoke_spec("fixtures/v2/precision-recall-shared-population.json")
shared_display <- read_rtichoke_spec("fixtures/v2/precision-recall-shared-display-group.json")

roc_gg <- render_roc_ggplot(roc)
roc_plotly <- render_roc_plotly(roc)
calibration_gg <- render_calibration_ggplot(calibration)
calibration_plotly <- render_calibration_plotly(calibration)
precision_recall_gg <- render_precision_recall_ggplot(precision_recall)
precision_recall_plotly <- render_precision_recall_plotly(precision_recall)
shared_display_gg <- render_precision_recall_ggplot(shared_display)
shared_display_plotly <- render_precision_recall_plotly(shared_display)

stopifnot(inherits(roc_gg, "ggplot"))
stopifnot(inherits(calibration_gg, "ggplot"))
stopifnot(inherits(precision_recall_gg, "ggplot"))
stopifnot(inherits(roc_plotly, "plotly"))
stopifnot(inherits(calibration_plotly, "plotly"))
stopifnot(inherits(precision_recall_plotly, "plotly"))
stopifnot(identical(roc$schemaVersion, "2.0"))
stopifnot(identical(calibration$schemaVersion, "2.0"))
stopifnot(identical(precision_recall$schemaVersion, "2.0"))

shared_layer <- ggplot_build(shared_display_gg)$data[[1]]
stopifnot(length(unique(shared_layer$group)) == 2)
shared_traces <- plotly_build(shared_display_plotly)$x$data
stopifnot(length(shared_traces) >= 2)

out_dir <- "site/r-consumers"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

ggsave(file.path(out_dir, "roc-ggplot.png"), roc_gg, width = 6, height = 6, dpi = 120)
ggsave(file.path(out_dir, "calibration-ggplot.png"), calibration_gg, width = 6, height = 6, dpi = 120)
ggsave(file.path(out_dir, "precision-recall-ggplot.png"), precision_recall_gg, width = 6, height = 6, dpi = 120)

saveWidget(roc_plotly, file.path(out_dir, "roc-plotly.html"), selfcontained = FALSE)
saveWidget(calibration_plotly, file.path(out_dir, "calibration-plotly.html"), selfcontained = FALSE)
saveWidget(precision_recall_plotly, file.path(out_dir, "precision-recall-plotly.html"), selfcontained = FALSE)

cat("R ggplot2 + Plotly consumers rendered canonical v2 ROC, calibration, and precision-recall specs with series identity preserved\n")
