#!/usr/bin/env bash
# Converts downloaded JPG textures to KTX2 format using toktx (KTX-Software).
# Prerequisites: brew install ktx-software
# Run from the packages/textures/ directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
RAW_DIR="$PKG_DIR/assets-raw"
OUT_DIR="$PKG_DIR/assets/presets"

if ! command -v toktx &> /dev/null; then
  echo "Error: toktx not found. Install via: brew install ktx-software"
  exit 1
fi

PRESETS=(onyx dark-marble verde-marble light-marble white-marble steel dark-steel gold copper brushed-steel obsidian)

for preset in "${PRESETS[@]}"; do
  src_dir="$RAW_DIR/$preset"
  dst_dir="$OUT_DIR/$preset"

  if [ ! -d "$src_dir" ]; then
    echo "Warning: source directory not found: $src_dir (skipping)"
    continue
  fi

  # Skip if already converted (color.ktx2 exists and is non-empty).
  if [ -f "$dst_dir/color.ktx2" ] && [ -s "$dst_dir/color.ktx2" ]; then
    echo "==> $preset (already converted, skipping)"
    continue
  fi

  mkdir -p "$dst_dir"
  echo "==> Converting $preset..."

  # Color map: UASTC quality 3 + Zstandard, sRGB
  if [ -f "$src_dir/color.jpg" ]; then
    toktx --t2 \
      --encode uastc --uastc_quality 3 \
      --zcmp 19 \
      --assign_oetf srgb \
      --genmipmap \
      "$dst_dir/color.ktx2" "$src_dir/color.jpg"
    echo "    color.ktx2 (UASTC, sRGB)"
  fi

  # Normal map: UASTC quality 3 + Zstandard, linear
  if [ -f "$src_dir/normal.jpg" ]; then
    toktx --t2 \
      --encode uastc --uastc_quality 3 \
      --zcmp 19 \
      --assign_oetf linear \
      --genmipmap \
      "$dst_dir/normal.ktx2" "$src_dir/normal.jpg"
    echo "    normal.ktx2 (UASTC, linear)"
  fi

  # Roughness map: ETC1S clevel 4, linear
  if [ -f "$src_dir/roughness.jpg" ]; then
    toktx --t2 \
      --encode etc1s --clevel 4 \
      --assign_oetf linear \
      --genmipmap \
      "$dst_dir/roughness.ktx2" "$src_dir/roughness.jpg"
    echo "    roughness.ktx2 (ETC1S, linear)"
  fi

  # Displacement map: ETC1S clevel 4, linear (only some presets have this)
  if [ -f "$src_dir/displacement.jpg" ]; then
    toktx --t2 \
      --encode etc1s --clevel 4 \
      --assign_oetf linear \
      --genmipmap \
      "$dst_dir/displacement.ktx2" "$src_dir/displacement.jpg"
    echo "    displacement.ktx2 (ETC1S, linear)"
  fi

  echo "    Done: $dst_dir"
done

echo ""
echo "All textures converted to: $OUT_DIR"
echo "KTX2 files are ready for the @brewsite/textures package."
