#!/usr/bin/env python3
"""
Retarget a CC_Base FBX animation onto the robot Mixamo-style rig in a .blend,
then export an animation-only GLB.

Usage (via Blender):
  /Applications/Blender.app/Contents/MacOS/Blender --background \\
    --python scripts/retarget_fbx_to_robot_anim_glb.py -- \\
    --input path/to/anim.fbx \\
    --robot-blend path/to/robot.blend \\
    --output path/to/anim.mixamo.glb
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


MODEL_BONE_TYPES = {
    "Head",
    "HeadTop_End",
    "Hips",
    "LeftArm",
    "LeftFoot",
    "LeftForeArm",
    "LeftHand",
    "LeftHandIndex1",
    "LeftHandIndex2",
    "LeftHandIndex3",
    "LeftHandIndex4",
    "LeftHandMiddle1",
    "LeftHandMiddle2",
    "LeftHandMiddle3",
    "LeftHandMiddle4",
    "LeftHandPinky1",
    "LeftHandPinky2",
    "LeftHandPinky3",
    "LeftHandPinky4",
    "LeftHandRing1",
    "LeftHandRing2",
    "LeftHandRing3",
    "LeftHandRing4",
    "LeftHandThumb1",
    "LeftHandThumb2",
    "LeftHandThumb3",
    "LeftHandThumb4",
    "LeftLeg",
    "LeftShoulder",
    "LeftToeBase",
    "LeftToe_End",
    "LeftUpLeg",
    "Neck",
    "RightArm",
    "RightFoot",
    "RightForeArm",
    "RightHand",
    "RightHandIndex1",
    "RightHandIndex2",
    "RightHandIndex3",
    "RightHandIndex4",
    "RightHandMiddle1",
    "RightHandMiddle2",
    "RightHandMiddle3",
    "RightHandMiddle4",
    "RightHandPinky1",
    "RightHandPinky2",
    "RightHandPinky3",
    "RightHandPinky4",
    "RightHandRing1",
    "RightHandRing2",
    "RightHandRing3",
    "RightHandRing4",
    "RightHandThumb1",
    "RightHandThumb2",
    "RightHandThumb3",
    "RightHandThumb4",
    "RightLeg",
    "RightShoulder",
    "RightToeBase",
    "RightToe_End",
    "RightUpLeg",
    "Spine",
    "Spine1",
    "Spine2",
}


def strip_namespace(name: str) -> str:
    if ":" in name:
        return name.split(":")[-1]
    return name


def map_cc_to_mixamo(name: str) -> str | None:
    if not name:
        return None
    raw = strip_namespace(name)
    if raw.startswith("mixamorig:"):
        return raw
    if raw.startswith("mixamorig"):
        raw = raw.replace("mixamorig", "mixamorig:")
        return raw

    n = raw
    if n.startswith("CC_Base_"):
        n = n[len("CC_Base_") :]

    side = ""
    if n.startswith("R_"):
        side = "Right"
        n = n[2:]
    elif n.startswith("L_"):
        side = "Left"
        n = n[2:]

    mapped = None
    if n in ("Hips", "Hip", "Pelvis"):
        mapped = "Hips"
    elif n == "Spine":
        mapped = "Spine"
    elif n == "Spine01":
        mapped = "Spine1"
    elif n == "Spine02":
        mapped = "Spine2"
    elif n == "Neck":
        mapped = "Neck"
    elif n == "Head":
        mapped = "Head"
    elif n == "HeadTop_End":
        mapped = "HeadTop_End"
    elif n == "Clavicle":
        mapped = f"{side}Shoulder" if side else None
    elif n == "Upperarm":
        mapped = f"{side}Arm" if side else None
    elif n == "Forearm":
        mapped = f"{side}ForeArm" if side else None
    elif n == "Hand":
        mapped = f"{side}Hand" if side else None
    elif n == "Thigh":
        mapped = f"{side}UpLeg" if side else None
    elif n == "Calf":
        mapped = f"{side}Leg" if side else None
    elif n == "Foot":
        mapped = f"{side}Foot" if side else None
    elif n == "ToeBase":
        mapped = f"{side}ToeBase" if side else None
    else:
        for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
            if n.startswith(finger):
                suffix = n[len(finger) :]
                if suffix.isdigit() and side:
                    mapped = f"{side}Hand{finger}{suffix}"
                break

    if not mapped or mapped not in MODEL_BONE_TYPES:
        return None
    return f"mixamorig:{mapped}"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--robot-blend", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target-armature", default="", type=str)
    return parser.parse_args(argv)


def main() -> int:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    args = parse_args(argv)

    if not args.input.exists():
        raise SystemExit(f"Input FBX not found: {args.input}")
    if not args.robot_blend.exists():
        raise SystemExit(f"Robot .blend not found: {args.robot_blend}")

    bpy.ops.wm.open_mainfile(filepath=str(args.robot_blend))

    existing_armatures = {obj.name for obj in bpy.data.objects if obj.type == "ARMATURE"}

    bpy.ops.import_scene.fbx(filepath=str(args.input))

    new_armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE" and obj.name not in existing_armatures]
    source_armature = new_armatures[0] if new_armatures else None
    if not source_armature:
        raise SystemExit("No source armature found in imported FBX.")

    if args.target_armature:
        target_armature = bpy.data.objects.get(args.target_armature)
    else:
        target_armature = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE" and obj.name in existing_armatures), None)

    if not target_armature:
        raise SystemExit("No target armature found in robot .blend.")

    # Ensure pose mode on target.
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    target_armature.select_set(True)
    bpy.context.view_layer.objects.active = target_armature
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")

    # Build constraints.
    source_bone_names = [bone.name for bone in source_armature.pose.bones][:30]
    print(f"Source bone sample: {source_bone_names}")
    target_bone_names = [bone.name for bone in target_armature.pose.bones][:30]
    print(f"Target bone sample: {target_bone_names}")
    constraints_applied = 0
    for src_bone in source_armature.pose.bones:
        mapped = map_cc_to_mixamo(src_bone.name)
        if not mapped:
            continue
        if mapped not in target_armature.pose.bones:
            continue

        tgt_bone = target_armature.pose.bones[mapped]
        for c in list(tgt_bone.constraints):
            tgt_bone.constraints.remove(c)

        rot = tgt_bone.constraints.new(type="COPY_ROTATION")
        rot.target = source_armature
        rot.subtarget = src_bone.name
        rot.owner_space = "POSE"
        rot.target_space = "POSE"
        constraints_applied += 1

        if mapped == "mixamorigHips":
            loc = tgt_bone.constraints.new(type="COPY_LOCATION")
            loc.target = source_armature
            loc.subtarget = src_bone.name
            loc.owner_space = "POSE"
            loc.target_space = "POSE"
            constraints_applied += 1

    print(f"Applied constraints: {constraints_applied}")
    if constraints_applied < 5:
        raise SystemExit("Too few constraints applied; check bone name mapping.")

    # Find and bind source action.
    action = source_armature.animation_data.action if source_armature.animation_data else None
    if not action:
        actions = list(bpy.data.actions)
        action = actions[0] if actions else None
    if not action:
        raise SystemExit("No animation action found on source armature.")
    if not source_armature.animation_data:
        source_armature.animation_data_create()
    source_armature.animation_data.action = action

    frame_start, frame_end = action.frame_range
    bpy.context.scene.frame_start = int(frame_start)
    bpy.context.scene.frame_end = int(frame_end)
    bpy.context.scene.frame_set(int(frame_start))
    bpy.context.view_layer.update()

    # Bake constraints into a new action on the target armature.
    if not target_armature.animation_data:
        target_armature.animation_data_create()
    target_armature.animation_data.action = bpy.data.actions.new(name="retargeted_action")

    bpy.ops.nla.bake(
        frame_start=int(frame_start),
        frame_end=int(frame_end),
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        use_current_action=True,
        bake_types={"POSE"},
    )

    baked_action = target_armature.animation_data.action if target_armature.animation_data else None
    if not baked_action:
        raise SystemExit("Bake did not create an action on the target armature.")

    # Remove source armature to avoid exporting its actions.
    bpy.ops.object.mode_set(mode="OBJECT")
    if source_armature and source_armature.name in bpy.data.objects:
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        source_armature.select_set(True)
        bpy.ops.object.delete()

    # Remove all other actions to avoid exporting CC_Base tracks.
    for action in list(bpy.data.actions):
        if action != baked_action:
            bpy.data.actions.remove(action)

    # Export animation-only GLB.
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    target_armature.select_set(True)
    bpy.context.view_layer.objects.active = target_armature

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(args.output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_apply=True,
    )

    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
