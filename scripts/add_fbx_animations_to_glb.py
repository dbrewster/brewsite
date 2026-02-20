#!/usr/bin/env python3
"""
Add one or more FBX animation clips to an existing GLB via Blender.

This is intended for "same-skeleton" or "near-same-skeleton" workflows where the FBX
animation rig bone names match the target GLB's armature (exactly, or differing only
by a namespace prefix like "mixamorig:").

Example:
  python3 scripts/add_fbx_animations_to_glb.py \
    --blender /Applications/Blender.app/Contents/MacOS/Blender \
    --base public/assets/robot.glb \
    --out public/assets/robot.with-anims.glb \
    --clip "Idle_A=~/Downloads/idle_a.fbx" \
    --clip "Idle_B=~/Downloads/idle_b.fbx" \
    --in-place-root
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from string import Template
import json as _json


@dataclass(frozen=True)
class ClipSpec:
    name: str
    fbx_path: Path


BLENDER_SCRIPT = r"""
import bpy
import json
import re

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)

def import_glb(path: str):
    bpy.ops.import_scene.gltf(filepath=path)

def import_fbx(path: str):
    bpy.ops.import_scene.fbx(filepath=path)

def find_first_armature(objects):
    for obj in objects:
        if obj.type == "ARMATURE":
            return obj
    return None

def collect_bone_names(armature_obj):
    return [b.name for b in armature_obj.data.bones]

def strip_namespace(name: str) -> str:
    parts = name.split(":")
    return parts[-1] if parts else name

def build_bone_name_map(src_bones, dst_bones):
    dst_set = set(dst_bones)
    dst_lower = {n.lower(): n for n in dst_bones}

    mapped = {}
    for src in src_bones:
        if src in dst_set:
            mapped[src] = src
            continue
        short = strip_namespace(src)
        if short in dst_set:
            mapped[src] = short
            continue
        lower = short.lower()
        if lower in dst_lower:
            mapped[src] = dst_lower[lower]
            continue
        # Try suffix match (namespace differences).
        suffix = ":" + short
        candidates = [n for n in dst_bones if n.endswith(suffix)]
        if candidates:
            # Prefer the shortest match.
            candidates.sort(key=lambda x: len(x))
            mapped[src] = candidates[0]
            continue
        mapped[src] = None

    return mapped

_BONE_RE = re.compile(r'pose\.bones\["([^"]+)"\]')

def remap_action_bone_paths(action, bone_name_map):
    changed = 0
    skipped = 0
    for fcurve in action.fcurves:
        m = _BONE_RE.search(fcurve.data_path)
        if not m:
            continue
        src_name = m.group(1)
        dst_name = bone_name_map.get(src_name)
        if not dst_name:
            skipped += 1
            continue
        if dst_name == src_name:
            continue
        fcurve.data_path = fcurve.data_path.replace(f'pose.bones["{src_name}"]', f'pose.bones["{dst_name}"]')
        changed += 1
    return changed, skipped

def zero_root_motion(action, root_bone_name: str):
    # Zero X/Z translation on the root bone (keep Y for subtle breathing if present).
    for fcurve in action.fcurves:
        if f'pose.bones["{root_bone_name}"].location' not in fcurve.data_path:
            continue
        # location: 0=x, 1=y, 2=z
        if fcurve.array_index in (0, 2):
            for kp in fcurve.keyframe_points:
                kp.co[1] = 0.0
                kp.handle_left[1] = 0.0
                kp.handle_right[1] = 0.0

def delete_objects(objs):
    for obj in objs:
        try:
            obj.select_set(True)
        except Exception:
            pass
    bpy.ops.object.delete()

clear_scene()

base_path = r"$base_path"
out_path = r"$out_path"
clip_specs = json.loads(r'''$clip_specs_json''')
in_place_root = $in_place_root
debug = $debug

import_glb(base_path)

base_objects = list(bpy.context.scene.objects)
base_armature = find_first_armature(base_objects)
if not base_armature:
    raise RuntimeError(f"No ARMATURE found in base GLB: {base_path}")

base_bones = collect_bone_names(base_armature)

if debug:
    print(f"Base armature: {base_armature.name} (bones={len(base_bones)})")

if not base_armature.animation_data:
    base_armature.animation_data_create()

for clip in clip_specs:
    clip_name = clip["name"]
    fbx_path = clip["fbx"]

    before_actions = set(bpy.data.actions)
    before_objects = set(bpy.context.scene.objects)

    import_fbx(fbx_path)

    after_actions = set(bpy.data.actions)
    after_objects = set(bpy.context.scene.objects)

    new_actions = [a for a in (after_actions - before_actions)]
    new_objects = [o for o in (after_objects - before_objects)]

    src_armature = find_first_armature(new_objects)
    if not src_armature:
        delete_objects(new_objects)
        raise RuntimeError(f"No ARMATURE found in FBX: {fbx_path}")

    src_bones = collect_bone_names(src_armature)
    bone_map = build_bone_name_map(src_bones, base_bones)
    unresolved = [k for k, v in bone_map.items() if v is None]
    if unresolved and debug:
        print(f"[{clip_name}] Unresolved bones (showing first 20): {unresolved[:20]}")

    if not new_actions:
        delete_objects(new_objects)
        raise RuntimeError(f"No Actions imported from FBX: {fbx_path}")

    # Heuristic: pick the action with the most fcurves (usually the actual clip).
    new_actions.sort(key=lambda a: len(a.fcurves), reverse=True)
    src_action = new_actions[0]
    dst_action = src_action.copy()
    dst_action.name = clip_name
    dst_action.use_fake_user = True

    changed, skipped = remap_action_bone_paths(dst_action, bone_map)
    if debug:
        print(f"[{clip_name}] action={src_action.name} fcurves={len(dst_action.fcurves)} remapped={changed} skipped={skipped}")

    if in_place_root:
        # Try canonical Mixamo root name first, then fall back to the first bone.
        root_name = None
        for candidate in ("mixamorig:Hips", "Hips", "pelvis", "Pelvis"):
            if candidate in base_bones:
                root_name = candidate
                break
        if not root_name and base_bones:
            root_name = base_bones[0]
        if root_name:
            zero_root_motion(dst_action, root_name)
            if debug:
                print(f"[{clip_name}] in-place root: {root_name}")

    # Clean up imported FBX objects to keep export deterministic.
    delete_objects(new_objects)

# Ensure world matrices are up to date.
bpy.context.view_layer.update()

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
)

print(f"Wrote {out_path}")
"""


def parse_clip(value: str) -> ClipSpec:
    if "=" not in value:
        raise argparse.ArgumentTypeError('Expected --clip in format "Name=/path/to/anim.fbx"')
    name, path_str = value.split("=", 1)
    name = name.strip()
    if not name:
        raise argparse.ArgumentTypeError("Clip name cannot be empty.")
    fbx_path = Path(path_str.strip()).expanduser()
    return ClipSpec(name=name, fbx_path=fbx_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Add FBX animations to a GLB via Blender.")
    parser.add_argument(
        "--blender",
        type=Path,
        required=True,
        help="Path to Blender executable (e.g. /Applications/Blender.app/Contents/MacOS/Blender).",
    )
    parser.add_argument("--base", type=Path, required=True, help="Path to base .glb file (with rig/mesh).")
    parser.add_argument("--out", type=Path, required=True, help="Path to output .glb file.")
    parser.add_argument(
        "--clip",
        type=parse_clip,
        action="append",
        required=True,
        help='Repeatable. Format: "ClipName=/path/to/clip.fbx"',
    )
    parser.add_argument(
        "--in-place-root",
        action="store_true",
        help="Zero root X/Z translation on the root bone to prevent drifting.",
    )
    parser.add_argument("--debug", action="store_true", help="Print debugging info from Blender.")
    args = parser.parse_args()

    blender_path = args.blender.expanduser().resolve()
    base_path = args.base.expanduser().resolve()
    out_path = args.out.expanduser().resolve()
    clips = args.clip

    if not blender_path.exists():
        raise SystemExit(f"Blender executable not found: {blender_path}")
    if not base_path.exists():
        raise SystemExit(f"Base GLB not found: {base_path}")
    if base_path.suffix.lower() != ".glb":
        raise SystemExit("--base must be a .glb file.")

    for clip in clips:
        if not clip.fbx_path.exists():
            raise SystemExit(f"FBX not found for clip '{clip.name}': {clip.fbx_path}")
        if clip.fbx_path.suffix.lower() != ".fbx":
            raise SystemExit(f"Clip '{clip.name}' must be a .fbx file: {clip.fbx_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    clip_specs = [{"name": c.name, "fbx": str(c.fbx_path.expanduser().resolve())} for c in clips]
    clip_specs_json = _json.dumps(clip_specs)

    script_body = Template(BLENDER_SCRIPT).substitute(
        base_path=str(base_path),
        out_path=str(out_path),
        clip_specs_json=clip_specs_json,
        in_place_root="True" if args.in_place_root else "False",
        debug="True" if args.debug else "False",
    )

    with tempfile.NamedTemporaryFile("w", suffix="_add_anims_to_glb.py", delete=False) as script_file:
        script_file.write(script_body)
        script_path = Path(script_file.name)

    try:
        subprocess.run([str(blender_path), "--background", "--python", str(script_path)], check=True)
    finally:
        try:
            script_path.unlink(missing_ok=True)
        except OSError:
            pass

    if not out_path.exists():
        raise SystemExit(f"Output GLB not created: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
