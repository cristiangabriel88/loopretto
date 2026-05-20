#!/usr/bin/env bash
# Build the Loopretto macOS app (.app) and a release zip.
# Run from the project root:  ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

echo
echo "=== Building Loopretto for macOS ==="
echo

# --- Reuse (or create) the project venv ---
if [ ! -x ".venv/bin/python" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
PY=".venv/bin/python"

echo "Installing app + build dependencies..."
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet -r requirements.txt
"$PY" -m pip install --quiet pyinstaller pillow

echo "Generating app icon..."
"$PY" scripts/make_icons.py

echo "Cleaning previous build output..."
rm -rf "dist/Loopretto.app"

echo "Building the app bundle (this can take a few minutes)..."
"$PY" -m PyInstaller loopretto.spec --noconfirm

echo "Packaging the release zip..."
ZIP="dist/Loopretto-macos.zip"
rm -f "$ZIP"
# ditto preserves the .app bundle structure/metadata better than plain zip.
ditto -c -k --sequesterRsrc --keepParent "dist/Loopretto.app" "$ZIP"

echo
echo "=== Done ==="
echo "App:  dist/Loopretto.app"
echo "Zip:  $ZIP"
echo
echo "Upload $ZIP to the GitHub Releases page."
echo
echo "Note: the app is unsigned. First launch needs right-click > Open"
echo "(or: System Settings > Privacy & Security > Open Anyway)."
