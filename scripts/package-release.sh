#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
SOURCE_COMMIT="${SOURCE_COMMIT:-$(git rev-parse HEAD)}"
BUNDLE="rtichoke-viz-${VERSION}"
OUTPUT_DIR="${1:-release}"

rm -rf "${OUTPUT_DIR:?}/${BUNDLE}"
mkdir -p "${OUTPUT_DIR}/${BUNDLE}"
cp dist/rtichoke-viz.js "${OUTPUT_DIR}/${BUNDLE}/"
cp dist/rtichoke-viz.css "${OUTPUT_DIR}/${BUNDLE}/"
cp schemas/rtichoke-viz.schema.json "${OUTPUT_DIR}/${BUNDLE}/"
cp schemas/rtichoke-viz-v2.schema.json "${OUTPUT_DIR}/${BUNDLE}/"
printf 'version=%s\ncommit=%s\n' "${VERSION}" "${SOURCE_COMMIT}" \
  > "${OUTPUT_DIR}/${BUNDLE}/MANIFEST"
tar -C "${OUTPUT_DIR}" -czf "${OUTPUT_DIR}/${BUNDLE}.tar.gz" "${BUNDLE}"
sha256sum "${OUTPUT_DIR}/${BUNDLE}.tar.gz" \
  > "${OUTPUT_DIR}/${BUNDLE}.tar.gz.sha256"
