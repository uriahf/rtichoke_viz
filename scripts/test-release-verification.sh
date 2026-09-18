#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Running release verification test suite"
echo "=================================================="

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# Copy working repository state into temporary test environment
WORKDIR="${TMP_DIR}/repo"
cp -R . "${WORKDIR}"
cd "${WORKDIR}"

VERSION="$(node -p "require('./package.json').version")"
BUNDLE="rtichoke-viz-${VERSION}"

# Ensure dist and schemas are built in workdir
npm run build >/dev/null 2>&1
npm run schema >/dev/null 2>&1

echo "[1/7] Positive test: Valid committed release artifact..."
if ! bash scripts/verify-committed-release.sh release >/dev/null 2>&1; then
  echo "FAIL: Valid committed release verification failed unexpectedly!" >&2
  exit 1
fi
echo "  PASS: Valid committed release verified successfully."

echo "[2/7] Negative test 1: Bad archive checksum mismatch..."
echo "corrupted" >> "release/${BUNDLE}.tar.gz"
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on checksum mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -qi "sha256sum\|checksum\|FAILED"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught bad archive checksum: ${ERR}"
fi
# Restore archive
git checkout -- "release/${BUNDLE}.tar.gz"

echo "[3/7] Negative test 2: MANIFEST version mismatch..."
sed -i 's/version=.*/version=0.99.99/' "release/${BUNDLE}/MANIFEST"
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on MANIFEST version mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "MANIFEST version .* does not match package.json version"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught MANIFEST version mismatch: ${ERR}"
fi
# Restore MANIFEST
git checkout -- "release/${BUNDLE}/MANIFEST"

echo "[4/7] Negative test 3: Invalid MANIFEST source commit..."
sed -i 's/commit=.*/commit=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef/' "release/${BUNDLE}/MANIFEST"
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on invalid source commit, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "SOURCE_COMMIT .* is not a valid git commit"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught invalid source commit: ${ERR}"
fi
# Restore MANIFEST
git checkout -- "release/${BUNDLE}/MANIFEST"

echo "[5/7] Negative test 4: Archive payload differs from committed release directory..."
# Add an extra file to the committed directory without putting it in the tar.gz
touch "release/${BUNDLE}/extra-file.txt"
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on archive payload mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "Extracted archive payload does not match committed release directory"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught archive payload mismatch: ${ERR}"
fi
# Remove extra file
rm "release/${BUNDLE}/extra-file.txt"

echo "[6/7] Negative test 5: Built JS/schema payload differs from committed payload..."
echo "// drift" >> dist/rtichoke-viz.js
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on built output payload mismatch, but succeeded!" >&2
  exit 1
else
  echo "  PASS: Caught built payload mismatch."
fi
# Restore dist
npm run build >/dev/null 2>&1

echo "[7/7] Negative test 6: Source drift outside release/ between SOURCE_COMMIT and TARGET_COMMIT..."
# Create a dummy commit in test repo that modifies a source file outside release/
echo "// drift" >> src/index.ts
git config user.name "Test"
git config user.email "test@example.com"
git commit -am "unrelated source change" >/dev/null 2>&1
if ERR="$(bash scripts/verify-committed-release.sh release 2>&1)"; then
  echo "FAIL: Expected failure on source drift outside release/, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "Source drift detected between SOURCE_COMMIT"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught source drift outside release/: ${ERR}"
fi

echo "=================================================="
echo "All 7 verification test cases PASSED successfully!"
echo "=================================================="
