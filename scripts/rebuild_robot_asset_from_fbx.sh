#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Rebuild robot GLBs from FBX with Mixamo-colon naming.

Defaults:
  out-with-normals: <input dir>/<input basename>.with-normals.glb
  out-no-normals:   <input dir>/<input basename>.no-normals.glb
  fbx2gltf: resolved from node_modules/fbx2gltf/bin
  keep-temp: false
  target: mixamo

Usage:
  bash scripts/rebuild_robot_asset_from_fbx.sh --input path/to/model.fbx
  bash scripts/rebuild_robot_asset_from_fbx.sh --input path/to/model.fbx
  bash scripts/rebuild_robot_asset_from_fbx.sh --fbx2gltf /path/to/FBX2glTF
  bash scripts/rebuild_robot_asset_from_fbx.sh --out-with path/to/with.glb --out-no path/to/no.glb
  bash scripts/rebuild_robot_asset_from_fbx.sh --keep-temp
  bash scripts/rebuild_robot_asset_from_fbx.sh --target cc_base
USAGE
}

INPUT=""
OUT_WITH=""
OUT_NO=""
FBX2GLTF=""
KEEP_TEMP="false"
TARGET="mixamo"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT="$2"
      shift 2
      ;;
    --out-with)
      OUT_WITH="$2"
      shift 2
      ;;
    --out-no)
      OUT_NO="$2"
      shift 2
      ;;
    --fbx2gltf)
      FBX2GLTF="$2"
      shift 2
      ;;
    --keep-temp)
      KEEP_TEMP="true"
      shift 1
      ;;
    --target)
      TARGET="$2"
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

if [[ -z "$INPUT" ]]; then
  echo "Missing --input <path-to-fbx>" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "Input .fbx not found: $INPUT" >&2
  exit 1
fi
if [[ -z "$OUT_WITH" || -z "$OUT_NO" ]]; then
  INPUT_DIR="$(dirname "$INPUT")"
  INPUT_BASE="$(basename "$INPUT")"
  INPUT_STEM="${INPUT_BASE%.*}"
  if [[ -z "$OUT_WITH" ]]; then
    OUT_WITH="$INPUT_DIR/$INPUT_STEM.with-normals.glb"
  fi
  if [[ -z "$OUT_NO" ]]; then
    OUT_NO="$INPUT_DIR/$INPUT_STEM.no-normals.glb"
  fi
fi

if [[ -z "$FBX2GLTF" ]]; then
  OS="$(uname -s)"
  case "$OS" in
    Darwin) FBX2GLTF="$(pwd)/node_modules/fbx2gltf/bin/Darwin/FBX2glTF" ;;
    Linux) FBX2GLTF="$(pwd)/node_modules/fbx2gltf/bin/Linux/FBX2glTF" ;;
    *) echo "Unsupported OS for fbx2gltf auto-resolve: $OS" >&2; exit 1 ;;
  esac
fi
if [[ ! -x "$FBX2GLTF" ]]; then
  echo "FBX2glTF executable not found/executable: $FBX2GLTF" >&2
  exit 1
fi
if [[ "$TARGET" != "mixamo" && "$TARGET" != "cc_base" ]]; then
  echo "Unknown --target: $TARGET (expected mixamo or cc_base)" >&2
  exit 1
fi

OUT_WITH_DIR="$(dirname "$OUT_WITH")"
OUT_NO_DIR="$(dirname "$OUT_NO")"
mkdir -p "$OUT_WITH_DIR" "$OUT_NO_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
TMP_DIR="$(mktemp -d -t "robot_fbx.$TS.XXXXXX")"
RAW="$TMP_DIR/robot.raw.glb"
RENAMED="$TMP_DIR/robot.renamed.glb"
WITH_TMP="$TMP_DIR/robot.with-normals.glb"
NO_TMP="$TMP_DIR/robot.no-normals.glb"

WITH_COMP="$TMP_DIR/robot.with-normals.comp.glb"
WITH_QUANT="$TMP_DIR/robot.with-normals.quant.glb"
NO_COMP="$TMP_DIR/robot.no-normals.comp.glb"
NO_QUANT="$TMP_DIR/robot.no-normals.quant.glb"

"$FBX2GLTF" -i "$INPUT" -o "$RAW"
node scripts/rename_gltf_mixamo.mjs "$RAW" "$RENAMED" --target "$TARGET"

node scripts/strip_normal_maps.mjs "$RENAMED" "$WITH_TMP"
node scripts/strip_normal_maps.mjs "$RENAMED" "$NO_TMP" --strip

python3 scripts/compress_glb_ktx2.py "$WITH_TMP" "$WITH_COMP" --mode hybrid
node node_modules/@gltf-transform/cli/bin/cli.js quantize "$WITH_COMP" "$WITH_QUANT" --quantization-volume scene

python3 scripts/compress_glb_ktx2.py "$NO_TMP" "$NO_COMP" --mode hybrid
node node_modules/@gltf-transform/cli/bin/cli.js quantize "$NO_COMP" "$NO_QUANT" --quantization-volume scene

mv -f "$WITH_QUANT" "$OUT_WITH"
mv -f "$NO_QUANT" "$OUT_NO"

if [[ "$KEEP_TEMP" == "true" ]]; then
  echo "Keeping temp dir: $TMP_DIR"
else
  rm -rf "$TMP_DIR"
fi

ls -la "$OUT_WITH" "$OUT_NO"
