#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
EXPECTED_COMMIT="${SOURCE_COMMIT:-$(git rev-parse HEAD)}"
BUNDLE="rtichoke-viz-${VERSION}"
OUTPUT_DIR="${1:-release}"
ARCHIVE="${OUTPUT_DIR}/${BUNDLE}.tar.gz"

git cat-file -e "${EXPECTED_COMMIT}^{commit}"

test -f "${ARCHIVE}"
test -f "${ARCHIVE}.sha256"
(
  cd "${OUTPUT_DIR}"
  sha256sum -c "${BUNDLE}.tar.gz.sha256"
)

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
tar -C "${tmp}" -xzf "${ARCHIVE}"

test -s "${tmp}/${BUNDLE}/rtichoke-viz.js"
test -s "${tmp}/${BUNDLE}/rtichoke-viz.css"
test -s "${tmp}/${BUNDLE}/rtichoke-viz.schema.json"
test -s "${tmp}/${BUNDLE}/rtichoke-viz-v2.schema.json"
test -s "${tmp}/${BUNDLE}/rtichoke-viz-report.schema.json"
test -s "${tmp}/${BUNDLE}/MANIFEST"
grep -Fxq "version=${VERSION}" "${tmp}/${BUNDLE}/MANIFEST"
grep -Fxq "commit=${EXPECTED_COMMIT}" "${tmp}/${BUNDLE}/MANIFEST"
node -e '
  const fs = require("node:fs");
  const checks = [
    [process.argv[1], "https://rtichoke.dev/schema/viz/1.0.json"],
    [process.argv[2], "https://rtichoke.dev/schema/viz/2.0.json"],
    [process.argv[3], "https://rtichoke.dev/schema/viz/report.json"],
  ];
  for (const [path, expectedId] of checks) {
    const schema = JSON.parse(fs.readFileSync(path, "utf8"));
    if (schema.$id !== expectedId) {
      throw new Error(`unexpected schema id in ${path}: ${schema.$id}`);
    }
  }
' \
  "${tmp}/${BUNDLE}/rtichoke-viz.schema.json" \
  "${tmp}/${BUNDLE}/rtichoke-viz-v2.schema.json" \
  "${tmp}/${BUNDLE}/rtichoke-viz-report.schema.json"
