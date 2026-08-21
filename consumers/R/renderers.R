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

has_identity_reference <- function(spec) {
  !is.null(spec$references) && any(spec$references$type == "identity")
}

attach_display_group <- function(spec, dat) {
  groups <- data.frame(
    seriesId = spec$series$id,
    group = spec$series$display$group
  )
  merge(dat, groups, by = "seriesId", sort = FALSE)
}

render_roc_ggplot <- function(spec) {
  dat <- attach_display_group(spec, spec$data)
  dat$false_positive_rate <- 1 - dat$specificity
  one_group <- length(unique(dat$group)) == 1

  p <- ggplot(dat, aes(x = false_positive_rate, y = sensitivity, color = group, group = seriesId)) +
    geom_line(linewidth = 0.8) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())

  if (has_identity_reference(spec)) {
    p <- p + geom_abline(slope = 1, intercept = 0, color = "grey")
  }
  if (one_group) {
    p <- p + scale_color_manual(values = "black") + theme(legend.position = "none")
  } else {
    p <- p + scale_color_manual(values = rtichoke_colors)
  }
  p
}

render_roc_plotly <- function(spec) {
  ggplotly(render_roc_ggplot(spec), tooltip = c("group", "false_positive_rate", "sensitivity")) |>
    config(displayModeBar = FALSE)
}

render_calibration_ggplot <- function(spec) {
  dat <- attach_display_group(spec, spec$data)
  one_group <- length(unique(dat$group)) == 1

  p <- ggplot(dat, aes(x = predicted, y = observed, color = group, group = seriesId)) +
    geom_line(linewidth = 0.8) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())

  if (any(dat$method == "discrete")) p <- p + geom_point(size = 2.5)
  if (has_identity_reference(spec)) {
    p <- p + geom_abline(slope = 1, intercept = 0, linetype = "dashed", color = "grey")
  }
  if (one_group) {
    p <- p + scale_color_manual(values = "black") + theme(legend.position = "none")
  } else {
    p <- p + scale_color_manual(values = rtichoke_colors)
  }
  p
}

render_calibration_plotly <- function(spec) {
  main <- ggplotly(
    render_calibration_ggplot(spec),
    tooltip = c("group", "predicted", "observed", "events", "total")
  )
  if (is.null(spec$distribution) || nrow(spec$distribution) == 0) {
    return(config(main, displayModeBar = FALSE))
  }

  dist <- attach_display_group(spec, spec$distribution)
  groups <- unique(dist$group)
  colors <- if (length(groups) == 1) "black" else rtichoke_colors[seq_along(groups)]
  hist <- plot_ly()
  for (i in seq_along(groups)) {
    group <- groups[[i]]
    d <- dist[dist$group == group, , drop = FALSE]
    hist <- add_bars(
      hist,
      data = d,
      x = ~midpoint,
      y = ~count,
      name = group,
      marker = list(color = colors[[i]]),
      opacity = 1 / length(groups),
      width = ~binWidth,
      showlegend = FALSE,
      text = ~paste0(count, " observations in [", midpoint - binWidth / 2, ", ", midpoint + binWidth / 2, "]"),
      hoverinfo = "text"
    )
  }
  subplot(main, hist, nrows = 2, shareX = TRUE, heights = c(0.8, 0.2)) |>
    config(displayModeBar = FALSE)
}

render_precision_recall_ggplot <- function(spec) {
  dat <- attach_display_group(spec, spec$data)
  one_group <- length(unique(dat$group)) == 1
  p <- ggplot(dat, aes(x = sensitivity, y = ppv, color = group, group = seriesId)) +
    geom_line(linewidth = 0.8) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())
  if (!is.null(spec$references)) {
    refs <- spec$references[spec$references$type == "horizontal", , drop = FALSE]
    if (nrow(refs) > 0) {
      p <- p + geom_hline(yintercept = refs$value, color = "grey", linetype = "dotted")
    }
  }
  if (one_group) {
    p <- p + scale_color_manual(values = "black") + theme(legend.position = "none")
  } else {
    p <- p + scale_color_manual(values = rtichoke_colors)
  }
  p
}

render_precision_recall_plotly <- function(spec) {
  ggplotly(render_precision_recall_ggplot(spec), tooltip = c("group", "sensitivity", "ppv", "cutoff")) |>
    config(displayModeBar = FALSE)
}
