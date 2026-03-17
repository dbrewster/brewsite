#!/usr/bin/env bash
# Downloads PBR texture source files from AmbientCG (CC0 license) at 2K resolution.
# Run from the packages/textures/ directory.
# Compatible with macOS system bash (3.x) — no associative arrays.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
RAW_DIR="$PKG_DIR/assets-raw"

mkdir -p "$RAW_DIR"

# Texture source map: "preset:AmbientCG_ID" pairs (no associative arrays — macOS bash 3.x).
TEXTURES="
onyx:Onyx001
dark-marble:Marble006
verde-marble:Marble009
light-marble:Marble012
white-marble:Marble001
steel:Metal032
dark-steel:Metal033
gold:Metal034
copper:Metal035
brushed-steel:Metal012
obsidian:Rock041
"

for entry in $TEXTURES; do
  preset="${entry%%:*}"
  id="${entry##*:}"
  zip_url="https://ambientcg.com/get?file=${id}_2K-JPG.zip"
  zip_file="$RAW_DIR/${id}_2K-JPG.zip"
  preset_dir="$RAW_DIR/$preset"

  echo "==> Downloading $preset ($id)..."

  if [ ! -f "$zip_file" ]; then
    curl -L -o "$zip_file" "$zip_url"
  else
    echo "    (already downloaded)"
  fi

  mkdir -p "$preset_dir"
  unzip -o -q "$zip_file" -d "$preset_dir"

  # Rename files to standard names, stripping size suffix.
  cd "$preset_dir"
  for f in *_Color.*; do [ -f "$f" ] && mv "$f" "color.jpg"; done 2>/dev/null || true
  for f in *_NormalGL.*; do [ -f "$f" ] && mv "$f" "normal.jpg"; done 2>/dev/null || true
  for f in *_Roughness.*; do [ -f "$f" ] && mv "$f" "roughness.jpg"; done 2>/dev/null || true
  for f in *_Displacement.*; do [ -f "$f" ] && mv "$f" "displacement.jpg"; done 2>/dev/null || true

  # Remove files we don't need.
  rm -f *.blend *.usdc *.mtlx *.tres *_NormalDX.* *.png 2>/dev/null || true
  cd "$RAW_DIR"

  echo "    Done: $preset_dir"
done

echo ""
echo "All textures downloaded to: $RAW_DIR"
echo "Next step: run scripts/convert-textures.sh to convert to KTX2."
