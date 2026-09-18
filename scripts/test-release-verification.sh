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

# Ensure full commit history in test environment
if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" == "true" ]]; then
  git fetch --unshallow -q || true
fi

VERSION="$(node -p "require('./package.json').version")"
BUNDLE="rtichoke-viz-${VERSION}"
V0222_ARTIFACT_COMMIT="14697da3e3cc0a3fdcf2d9872971b0f948382d80"
VERIFY_SCRIPT="${TMP_DIR}/verify-committed-release.sh"
cp scripts/verify-committed-release.sh "${VERIFY_SCRIPT}"

# Ensure dist and schemas are built from V0222_ARTIFACT_COMMIT source for testing v0.22.2 committed release
git checkout -q "${V0222_ARTIFACT_COMMIT}" -- src/ package.json package-lock.json 2>/dev/null || true
npm run build >/dev/null 2>&1
npm run schema >/dev/null 2>&1
git checkout -q HEAD -- src/ package.json package-lock.json 2>/dev/null || true

echo "[1/7] Positive test: Valid committed v0.22.2 release artifact..."
if ! TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release >/dev/null 2>&1; then
  echo "FAIL: Valid committed release verification failed unexpectedly for v0.22.2!" >&2
  exit 1
fi
echo "  PASS: Valid committed release verified successfully."

echo "[2/7] Negative test 1: Bad archive checksum mismatch..."
echo "corrupted" >> "release/${BUNDLE}.tar.gz"
if ERR="$(TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on checksum mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -qi "sha256sum\|checksum\|FAILED"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught bad archive checksum."
fi
# Restore archive
git checkout -- "release/${BUNDLE}.tar.gz"

echo "[3/7] Negative test 2: MANIFEST version mismatch..."
sed -i 's/version=.*/version=0.99.99/' "release/${BUNDLE}/MANIFEST"
if ERR="$(TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on MANIFEST version mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "MANIFEST version .* does not match package.json version"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught MANIFEST version mismatch."
fi
# Restore MANIFEST
git checkout -- "release/${BUNDLE}/MANIFEST"

echo "[4/7] Negative test 3: Invalid MANIFEST source commit..."
sed -i 's/commit=.*/commit=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef/' "release/${BUNDLE}/MANIFEST"
if ERR="$(TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on invalid source commit, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "SOURCE_COMMIT .* is not a valid git commit"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught invalid source commit."
fi
# Restore MANIFEST
git checkout -- "release/${BUNDLE}/MANIFEST"

echo "[5/7] Negative test 4: Archive payload differs from committed release directory..."
touch "release/${BUNDLE}/extra-file.txt"
if ERR="$(TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on archive payload mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "Extracted archive payload does not match committed release directory"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught archive payload mismatch."
fi
# Remove extra file
rm "release/${BUNDLE}/extra-file.txt"

echo "[6/7] Negative test 5: Built JS/schema payload differs from committed payload..."
echo "// drift" >> dist/rtichoke-viz.js
if ERR="$(TARGET_COMMIT="${V0222_ARTIFACT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on built output payload mismatch, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "Built artifact dist/rtichoke-viz.js does not match committed release file"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught built payload mismatch."
fi
# Restore dist
npm run build >/dev/null 2>&1

echo "[7/7] Negative test 6: Source drift outside release/ between SOURCE_COMMIT and TARGET_COMMIT..."
# Create an isolated target commit derived from the valid v0.22.2 artifact state (14697da)
git reset --hard -q
git checkout -q "${V0222_ARTIFACT_COMMIT}"
echo "// drift" >> src/index.ts
git config user.name "Test"
git config user.email "test@example.com"
git commit -am "isolated non-release source change" >/dev/null 2>&1
ISOLATED_DRIFT_COMMIT="$(git rev-parse HEAD)"

if ERR="$(TARGET_COMMIT="${ISOLATED_DRIFT_COMMIT}" bash "${VERIFY_SCRIPT}" release 2>&1)"; then
  echo "FAIL: Expected failure on source drift outside release/, but succeeded!" >&2
  exit 1
else
  if ! echo "${ERR}" | grep -q "Source drift detected between SOURCE_COMMIT"; then
    echo "FAIL: Failed for wrong reason: ${ERR}" >&2
    exit 1
  fi
  echo "  PASS: Caught isolated source drift outside release/."
fi

echo "=================================================="
echo "All 7 verification test cases PASSED successfully!"
echo "=================================================="
