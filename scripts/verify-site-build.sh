#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-pages-site}"

REQUIRED_FILES=(
  "python-plotly/roc.html"
  "python-plotly/calibration.html"
  "python-plotly/precision-recall.html"
  "python-plotly/gains.html"
)

echo "Verifying site build in directory: ${SITE_DIR}"

for rel_path in "${REQUIRED_FILES[@]}"; do
  file_path="${SITE_DIR}/${rel_path}"
  if [[ ! -f "${file_path}" ]]; then
    echo "Error: Required site file missing: ${file_path}" >&2
    exit 1
  fi
  if [[ ! -s "${file_path}" ]]; then
    echo "Error: Required site file is empty: ${file_path}" >&2
    exit 1
  fi
  echo "OK: ${file_path} ($(wc -c < "${file_path}") bytes)"
done

echo "Site build verification PASSED for ${SITE_DIR}."
