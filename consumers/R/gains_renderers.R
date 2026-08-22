reference_paths <- function(spec) {
  if (is.null(spec$references)) return(list())
  refs <- spec$references
  paths <- list()
  for (i in seq_len(nrow(refs))) {
    if (refs$type[[i]] == "identity") {
      paths[[length(paths) + 1]] <- data.frame(x = c(0, 1), y = c(0, 1), reference = paste0("reference-", i))
    } else if (refs$type[[i]] == "path" && !is.null(refs$points[[i]])) {
      points <- refs$points[[i]]
      paths[[length(paths) + 1]] <- data.frame(x = points$x, y = points$y, reference = paste0("reference-", i))
    }
  }
  paths
}

render_gains_ggplot <- function(spec) {
  dat <- attach_display_group(spec, spec$data)
  one_group <- length(unique(dat$group)) == 1
  p <- ggplot(dat, aes(x = ppcr, y = sensitivity, color = group, group = seriesId)) +
    geom_line(linewidth = 0.8) +
    scale_x_continuous(name = spec$xAxis$label, limits = unlist(spec$xAxis$domain)) +
    scale_y_continuous(name = spec$yAxis$label, limits = unlist(spec$yAxis$domain)) +
    theme_minimal(base_size = 12) +
    theme(panel.grid = element_blank())
  for (path in reference_paths(spec)) {
    p <- p + geom_line(data = path, aes(x = x, y = y, group = reference), inherit.aes = FALSE, color = "grey", linetype = "dashed", linewidth = 0.8)
  }
  if (one_group) {
    p <- p + scale_color_manual(values = "black") + theme(legend.position = "none")
  } else {
    p <- p + scale_color_manual(values = rtichoke_colors)
  }
  p
}

render_gains_plotly <- function(spec) {
  ggplotly(render_gains_ggplot(spec), tooltip = c("label", "ppcr", "sensitivity", "cutoff")) |>
    config(displayModeBar = FALSE)
}
