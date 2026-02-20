#!/usr/bin/env python3
"""
Convert a .blend file to .glb using Blender in background mode.

Usage:
  python3 scripts/convert_blend_to_glb.py input.blend output.glb --blender /path/to/blender
  python3 scripts/convert_blend_to_glb.py input.blend output.glb --blender /path/to/blender --include-animations
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path


BLENDER_SCRIPT = r"""
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.open_mainfile(filepath=r"{input_path}")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(
    filepath=r"{output_path}",
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    export_animations={export_animations},
)
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert a .blend file to .glb via Blender.")
    parser.add_argument("input", type=Path, help="Path to input .blend file.")
    parser.add_argument("output", type=Path, help="Path to output .glb file.")
    parser.add_argument(
        "--blender",
        type=Path,
        required=True,
        help="Path to Blender executable (e.g. /Applications/Blender.app/Contents/MacOS/Blender).",
    )
    parser.add_argument(
        "--include-animations",
        action="store_true",
        help="Include animations/actions in output GLB (default: off).",
    )
    args = parser.parse_args()

    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    blender_path = args.blender.expanduser().resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    if input_path.suffix.lower() != ".blend":
        raise SystemExit("Input must be a .blend file.")
    if not blender_path.exists():
        raise SystemExit(f"Blender executable not found: {blender_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    script_body = BLENDER_SCRIPT.format(
        input_path=str(input_path),
        output_path=str(output_path),
        export_animations="True" if args.include_animations else "False",
    )

    with tempfile.NamedTemporaryFile("w", suffix="_blend_to_glb.py", delete=False) as script_file:
        script_file.write(script_body)
        script_path = Path(script_file.name)

    try:
        subprocess.run(
            [str(blender_path), "--background", "--python", str(script_path)],
            check=True,
        )
    finally:
        try:
            script_path.unlink(missing_ok=True)
        except OSError:
            pass

    if not output_path.exists():
        raise SystemExit(f"Output file not created: {output_path}")

    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
