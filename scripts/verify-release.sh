#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
BUNDLE="rtichoke-viz-${VERSION}"
OUTPUT_DIR="${1:-release}"
ARCHIVE="${OUTPUT_DIR}/${BUNDLE}.tar.gz"

sha256sum -c "${ARCHIVE}.sha256"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
tar -C "${tmp}" -xzf "${ARCHIVE}"

test -s "${tmp}/${BUNDLE}/rtichoke-viz.js"
test -s "${tmp}/${BUNDLE}/rtichoke-viz.css"
test -s "${tmp}/${BUNDLE}/rtichoke-viz.schema.json"
test -s "${tmp}/${BUNDLE}/rtichoke-viz-v2.schema.json"
test -s "${tmp}/${BUNDLE}/MANIFEST"
grep -qx "version=${VERSION}" "${tmp}/${BUNDLE}/MANIFEST"
grep -q '^commit=.' "${tmp}/${BUNDLE}/MANIFEST"
node -e '
  const fs = require("node:fs");
  const checks = [
    [process.argv[1], "https://rtichoke.dev/schema/viz/1.0.json"],
    [process.argv[2], "https://rtichoke.dev/schema/viz/2.0.json"],
  ];
  for (const [path, expectedId] of checks) {
    const schema = JSON.parse(fs.readFileSync(path, "utf8"));
    if (schema.$id !== expectedId) {
      throw new Error(`unexpected schema id in ${path}: ${schema.$id}`);
    }
  }
' \
  "${tmp}/${BUNDLE}/rtichoke-viz.schema.json" \
  "${tmp}/${BUNDLE}/rtichoke-viz-v2.schema.json"
