#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
BUNDLE="rtichoke-viz-${VERSION}"
OUTPUT_DIR="${1:-release}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git rev-parse HEAD)}"
MANIFEST="${OUTPUT_DIR}/${BUNDLE}/MANIFEST"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Error: MANIFEST file not found at ${MANIFEST}" >&2
  exit 1
fi

# Validate exactly one version= line
VERSION_LINES="$(grep -c '^version=' "${MANIFEST}" || true)"
if [[ "${VERSION_LINES}" -ne 1 ]]; then
  echo "Error: MANIFEST must contain exactly one version= line, found ${VERSION_LINES}" >&2
  exit 1
fi
MANIFEST_VERSION="$(grep '^version=' "${MANIFEST}" | cut -d'=' -f2)"

if [[ "${MANIFEST_VERSION}" != "${VERSION}" ]]; then
  echo "Error: MANIFEST version (${MANIFEST_VERSION}) does not match package.json version (${VERSION})" >&2
  exit 1
fi

# Validate exactly one commit= line
COMMIT_LINES="$(grep -c '^commit=' "${MANIFEST}" || true)"
if [[ "${COMMIT_LINES}" -ne 1 ]]; then
  echo "Error: MANIFEST must contain exactly one commit= line, found ${COMMIT_LINES}" >&2
  exit 1
fi
SOURCE_COMMIT="$(grep '^commit=' "${MANIFEST}" | cut -d'=' -f2)"

# Validate source commit is a valid Git commit
if ! git cat-file -e "${SOURCE_COMMIT}^{commit}" 2>/dev/null; then
  echo "Error: SOURCE_COMMIT (${SOURCE_COMMIT}) is not a valid git commit" >&2
  exit 1
fi

# Validate source commit is an ancestor of target commit
if ! git merge-base --is-ancestor "${SOURCE_COMMIT}" "${TARGET_COMMIT}"; then
  echo "Error: SOURCE_COMMIT (${SOURCE_COMMIT}) is not an ancestor of TARGET_COMMIT (${TARGET_COMMIT})" >&2
  exit 1
fi

# Validate no source drift outside release/ between SOURCE_COMMIT and TARGET_COMMIT
if ! git diff --quiet "${SOURCE_COMMIT}" "${TARGET_COMMIT}" -- . ':(exclude)release'; then
  echo "Error: Source drift detected between SOURCE_COMMIT (${SOURCE_COMMIT}) and TARGET_COMMIT (${TARGET_COMMIT}) outside release/" >&2
  exit 1
fi

# Call verify-release.sh with parsed SOURCE_COMMIT
SOURCE_COMMIT="${SOURCE_COMMIT}" bash scripts/verify-release.sh "${OUTPUT_DIR}"

# Archive payload ↔ committed release directory payload parity check
ARCHIVE="${OUTPUT_DIR}/${BUNDLE}.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
tar -C "${tmp}" -xzf "${ARCHIVE}"

if ! diff -r "${tmp}/${BUNDLE}" "${OUTPUT_DIR}/${BUNDLE}"; then
  echo "Error: Extracted archive payload does not match committed release directory ${OUTPUT_DIR}/${BUNDLE}" >&2
  exit 1
fi

# Built output ↔ committed release directory payload parity check
cmp dist/rtichoke-viz.js "${OUTPUT_DIR}/${BUNDLE}/rtichoke-viz.js"
cmp dist/rtichoke-viz.css "${OUTPUT_DIR}/${BUNDLE}/rtichoke-viz.css"
cmp schemas/rtichoke-viz.schema.json "${OUTPUT_DIR}/${BUNDLE}/rtichoke-viz.schema.json"
cmp schemas/rtichoke-viz-v2.schema.json "${OUTPUT_DIR}/${BUNDLE}/rtichoke-viz-v2.schema.json"
cmp schemas/rtichoke-viz-report.schema.json "${OUTPUT_DIR}/${BUNDLE}/rtichoke-viz-report.schema.json"

echo "Committed release verification successful for ${BUNDLE} (source commit: ${SOURCE_COMMIT})."
