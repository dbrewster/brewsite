#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Rebuild the robot model asset from .blend -> GLB (no animations) -> strip normal maps -> KTX2 compress.

Defaults:
  input:  public/android_humanoid_robot_rigged.blend
  output: public/assets/robot.ktx2.no-normals.glb
  blender: /Applications/Blender.app/Contents/MacOS/Blender

Usage:
  bash scripts/rebuild_robot_asset.sh
  bash scripts/rebuild_robot_asset.sh --input path/to/model.blend --output path/to/out.glb
  bash scripts/rebuild_robot_asset.sh --blender /path/to/Blender
EOF
}

INPUT="public/android_humanoid_robot_rigged.blend"
OUTPUT="public/assets/robot.ktx2.no-normals.glb"
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --blender)
      BLENDER="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$INPUT" ]]; then
  echo "Input .blend not found: $INPUT" >&2
  exit 1
fi
if [[ ! -x "$BLENDER" ]]; then
  echo "Blender executable not found/executable: $BLENDER" >&2
  exit 1
fi

OUT_DIR="$(dirname "$OUTPUT")"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
if [[ -f "$OUTPUT" ]]; then
  cp "$OUTPUT" "$OUTPUT.bak.$TS"
fi

TMP_DIR="$(mktemp -d -t "robot.$TS.XXXXXX")"
RAW="$TMP_DIR/robot.raw.glb"
NO_NORMALS="$TMP_DIR/robot.no-normals.glb"
OUT_TMP="$OUT_DIR/.tmp.$(basename "$OUTPUT").$TS.glb"
OUT_QUANT="$OUT_DIR/.tmp.$(basename "$OUTPUT").$TS.quant.glb"

python3 scripts/convert_blend_to_glb.py "$INPUT" "$RAW" --blender "$BLENDER"
node scripts/strip_normal_maps.mjs "$RAW" "$NO_NORMALS"
python3 scripts/compress_glb_ktx2.py "$NO_NORMALS" "$OUT_TMP" --mode hybrid

node node_modules/.bin/gltf-transform quantize "$OUT_TMP" "$OUT_QUANT" --quantization-volume scene

node node_modules/.bin/gltf-transform inspect "$OUT_QUANT" | rg -n "ANIMATIONS|No animations found\\.|extensionsRequired|extensionsUsed" || true

mv -f "$OUT_QUANT" "$OUTPUT"
rm -rf "$TMP_DIR"

ls -la "$OUTPUT"
