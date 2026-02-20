#!/usr/bin/env python3
"""
Compress GLB textures to KTX2 via gltf-transform (etc1s, uastc, or hybrid).

Prereqs:
  - Node.js + npm
  - gltf-transform CLI: npm install --global @gltf-transform/cli

Usage:
  python3 scripts/compress_glb_ktx2.py input.glb output.glb --mode etc1s
  python3 scripts/compress_glb_ktx2.py input.glb output.glb --mode uastc
  python3 scripts/compress_glb_ktx2.py input.glb output.glb --mode hybrid
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path


def resolve_binary(name: str) -> str:
    resolved = shutil.which(name)
    if resolved:
        return resolved
    repo_root = Path(__file__).resolve().parents[1]
    local_bin = repo_root / "node_modules" / ".bin" / name
    if local_bin.exists():
        return str(local_bin)
    raise SystemExit(f"Missing required binary: {name}")


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compress GLB textures to KTX2 using gltf-transform.")
    parser.add_argument("input", type=Path, help="Path to input .glb file.")
    parser.add_argument("output", type=Path, help="Path to output .glb file.")
    parser.add_argument(
        "--mode",
        choices=["etc1s", "uastc", "hybrid"],
        default="hybrid",
        help="KTX2 mode: etc1s (smaller), uastc (higher quality), or hybrid.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=255,
        help="ETC1S quality (1-255). Ignored for UASTC-only.",
    )
    parser.add_argument(
        "--level",
        type=int,
        default=4,
        help="UASTC compression level (0-4). Ignored for ETC1S.",
    )
    parser.add_argument(
        "--rdo-lambda",
        type=int,
        default=4,
        help="UASTC RDO lambda (higher = smaller, lower = higher quality).",
    )
    parser.add_argument(
        "--zstd",
        type=int,
        default=18,
        help="UASTC Zstandard level.",
    )
    parser.add_argument(
        "--uastc-slots",
        type=str,
        default="{normalTexture,occlusionTexture,metallicRoughnessTexture}",
        help="Texture slots to encode with UASTC in hybrid mode.",
    )
    args = parser.parse_args()

    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    if input_path.suffix.lower() != ".glb":
        raise SystemExit("Input must be a .glb file.")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    gltf_transform = resolve_binary("gltf-transform")

    if args.mode == "etc1s":
        run(
            [
                gltf_transform,
                "etc1s",
                str(input_path),
                str(output_path),
                "--quality",
                str(args.quality),
                "--verbose",
            ]
        )
    elif args.mode == "uastc":
        run(
            [
                gltf_transform,
                "uastc",
                str(input_path),
                str(output_path),
                "--level",
                str(args.level),
                "--rdo",
                "--rdo-lambda",
                str(args.rdo_lambda),
                "--zstd",
                str(args.zstd),
                "--verbose",
            ]
        )
    else:
        with tempfile.TemporaryDirectory() as tmp:
            temp_path = Path(tmp) / "uastc.glb"
            run(
                [
                    gltf_transform,
                    "uastc",
                    str(input_path),
                    str(temp_path),
                    "--slots",
                    args.uastc_slots,
                    "--level",
                    str(args.level),
                    "--rdo",
                    "--rdo-lambda",
                    str(args.rdo_lambda),
                    "--zstd",
                    str(args.zstd),
                    "--verbose",
                ]
            )
            run(
                [
                    gltf_transform,
                    "etc1s",
                    str(temp_path),
                    str(output_path),
                    "--quality",
                    str(args.quality),
                    "--verbose",
                ]
            )

    if not output_path.exists():
        raise SystemExit(f"Output file not created: {output_path}")

    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
