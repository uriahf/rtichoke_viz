#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
SOURCE_COMMIT="${SOURCE_COMMIT:-$(git rev-parse HEAD)}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git show -s --format=%ct "${SOURCE_COMMIT}")}" 
BUNDLE="rtichoke-viz-${VERSION}"
OUTPUT_DIR="${1:-release}"
ARCHIVE="${OUTPUT_DIR}/${BUNDLE}.tar.gz"
CHECKSUM="${ARCHIVE}.sha256"

# A release manifest must always identify a real source commit.
git cat-file -e "${SOURCE_COMMIT}^{commit}"

rm -rf "${OUTPUT_DIR:?}/${BUNDLE}"
rm -f "${ARCHIVE}" "${CHECKSUM}"
mkdir -p "${OUTPUT_DIR}/${BUNDLE}"
cp dist/rtichoke-viz.js "${OUTPUT_DIR}/${BUNDLE}/"
cp dist/rtichoke-viz.css "${OUTPUT_DIR}/${BUNDLE}/"
cp schemas/rtichoke-viz.schema.json "${OUTPUT_DIR}/${BUNDLE}/"
cp schemas/rtichoke-viz-v2.schema.json "${OUTPUT_DIR}/${BUNDLE}/"
cp schemas/rtichoke-viz-report.schema.json "${OUTPUT_DIR}/${BUNDLE}/"
printf 'version=%s\ncommit=%s\n' "${VERSION}" "${SOURCE_COMMIT}" \
  > "${OUTPUT_DIR}/${BUNDLE}/MANIFEST"

# Normalize archive metadata so rebuilding the same source payload produces the
# same bytes. gzip -n removes the gzip header timestamp and original filename.
tar \
  --sort=name \
  --mtime="@${SOURCE_DATE_EPOCH}" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  --format=gnu \
  -C "${OUTPUT_DIR}" \
  -cf - "${BUNDLE}" \
  | gzip -n > "${ARCHIVE}"

(
  cd "${OUTPUT_DIR}"
  sha256sum "${BUNDLE}.tar.gz" > "${BUNDLE}.tar.gz.sha256"
)
