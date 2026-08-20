library(jsonlite)
library(ggplot2)
library(plotly)

rtichoke_colors <- c(
  "#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#07004D",
  "#E6AB02", "#FE5F55", "#54494B", "#006E90", "#BC96E6"
)

read_rtichoke_spec <- function(path) {
  jsonlite::fromJSON(path, simplifyVector = TRUE)
}

render_roc_ggplot <- function(spec) {
  dat <- spec$data
  dat$false_positive_rate <- 1 - dat$specificity
  p <- ggplot(dat, aes(x = false_positive_rate, y = sensitivity, color = model)) +
    geom_line(linewidth = 0.8) +
    scale_color_manual(values = rtichoke_colors) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())
  if (!is.null(spec$references) && any(spec$references$type == "identity")) {
    p <- p + geom_abline(slope = 1, intercept = 0, color = "grey")
  }
  p
}

render_roc_plotly <- function(spec) {
  ggplotly(render_roc_ggplot(spec), tooltip = c("model", "false_positive_rate", "sensitivity"))
}

render_calibration_ggplot <- function(spec) {
  dat <- spec$data
  one_model <- length(unique(dat$model)) == 1
  p <- ggplot(dat, aes(x = predicted, y = observed, color = model, group = model)) +
    geom_line(linewidth = 0.8) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())
  if (any(dat$method == "discrete")) p <- p + geom_point(size = 2.5)
  if (!is.null(spec$references) && any(spec$references$type == "identity")) {
    p <- p + geom_abline(slope = 1, intercept = 0, linetype = "dashed", color = "grey")
  }
  if (one_model) {
    p <- p + scale_color_manual(values = "black") + theme(legend.position = "none")
  } else {
    p <- p + scale_color_manual(values = rtichoke_colors)
  }
  p
}

render_calibration_plotly <- function(spec) {
  ggplotly(render_calibration_ggplot(spec), tooltip = c("model", "predicted", "observed"))
}
