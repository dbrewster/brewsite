#!/usr/bin/env python3
"""
Convert an FBX to GLB via Blender and render a matching PNG.

Example:
  python3 scripts/convert_fbx_to_glb_png.py \\
    public/anroid_robot_rigged_and_materialed.fbx \\
    public/assets/robot.glb \\
    public/assets/robot.png \\
    --blender /Applications/Blender.app/Contents/MacOS/Blender \\
    --draco
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path


BLENDER_SCRIPT = r"""
import math
import bpy
from mathutils import Vector

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)

def import_fbx(path):
    bpy.ops.import_scene.fbx(filepath=path)
    objs = [obj for obj in bpy.context.scene.objects if obj.type in {{"MESH", "EMPTY", "ARMATURE"}}]
    return objs

def get_bounds(objects):
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world.x)
            min_v.y = min(min_v.y, world.y)
            min_v.z = min(min_v.z, world.z)
            max_v.x = max(max_v.x, world.x)
            max_v.y = max(max_v.y, world.y)
            max_v.z = max(max_v.z, world.z)
    return min_v, max_v

def setup_camera(bounds_min, bounds_max, azimuth_deg, elevation_deg, padding):
    center = (bounds_min + bounds_max) * 0.5
    size = bounds_max - bounds_min
    radius = max(size.x, size.y, size.z) * 0.5
    if radius <= 0:
        radius = 1
    dist = radius / math.tan(math.radians(30)) + padding
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    cam_x = center.x + dist * math.cos(el) * math.sin(az)
    cam_y = center.y + dist * math.cos(el) * math.cos(az)
    cam_z = center.z + dist * math.sin(el)

    cam_data = bpy.data.cameras.new("RobotCamera")
    cam = bpy.data.objects.new("RobotCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (cam_x, cam_y, cam_z)

    direction = center - cam.location
    rot_quat = direction.to_track_quat("-Z", "Y")
    cam.rotation_euler = rot_quat.to_euler()
    bpy.context.scene.camera = cam

def setup_light(bounds_min, bounds_max):
    size = bounds_max - bounds_min
    radius = max(size.x, size.y, size.z) * 0.5
    if radius <= 0:
        radius = 2
    light_data = bpy.data.lights.new(name="KeyLight", type="AREA")
    light_data.energy = 450
    light_data.size = radius * 2.5
    light = bpy.data.objects.new(name="KeyLight", object_data=light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = (0, -radius * 2.2, radius * 1.6)
    light.rotation_euler = (math.radians(50), 0, 0)

    fill_data = bpy.data.lights.new(name="FillLight", type="POINT")
    fill_data.energy = 120
    fill = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (radius * 1.5, radius * 1.3, radius * 1.1)

def render_png(path, size, transparent):
    scene = bpy.context.scene
    engine_options = {{item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}}
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES", "BLENDER_WORKBENCH"):
        if candidate in engine_options:
            scene.render.engine = candidate
            break
    scene.render.filepath = path
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    bpy.ops.render.render(write_still=True)

def export_glb(path, texture_format, draco, draco_level, draco_quant):
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    format_map = {{
        "AUTO": "AUTO",
        "JPEG": "JPEG",
        "WEBP": "WEBP",
        "PNG": "AUTO",
    }}
    resolved_format = format_map.get(texture_format, "AUTO")
    if resolved_format != "AUTO":
        kwargs["export_image_format"] = resolved_format
    if draco:
        kwargs["export_draco_mesh_compression_enable"] = True
        kwargs["export_draco_mesh_compression_level"] = draco_level
        kwargs["export_draco_position_quantization"] = draco_quant
        kwargs["export_draco_normal_quantization"] = draco_quant
        kwargs["export_draco_texcoord_quantization"] = draco_quant
        kwargs["export_draco_color_quantization"] = draco_quant
        kwargs["export_draco_generic_quantization"] = draco_quant
    bpy.ops.export_scene.gltf(**kwargs)

clear_scene()
import_fbx(r"{input_path}")

targets = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in targets:
    obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bounds_min, bounds_max = get_bounds(targets)
setup_camera(bounds_min, bounds_max, {azimuth}, {elevation}, {padding})
setup_light(bounds_min, bounds_max)

if r"{png_path}":
    render_png(r"{png_path}", {png_size}, {transparent})

export_glb(
    r"{glb_path}",
    r"{texture_format}",
    {draco},
    {draco_level},
    {draco_quant},
)
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert FBX to GLB (optional Draco) and render a PNG via Blender."
    )
    parser.add_argument("input", type=Path, help="Path to input .fbx file.")
    parser.add_argument("glb", type=Path, help="Path to output .glb file.")
    parser.add_argument("png", type=Path, help="Path to output .png file.")
    parser.add_argument(
        "--blender",
        type=Path,
        required=True,
        help="Path to Blender executable (e.g. /Applications/Blender.app/Contents/MacOS/Blender).",
    )
    parser.add_argument("--png-size", type=int, default=1024, help="PNG render size (square).")
    parser.add_argument(
        "--transparent",
        action="store_true",
        help="Render PNG with transparent background.",
    )
    parser.add_argument(
        "--azimuth",
        type=float,
        default=180.0,
        help="Camera azimuth angle in degrees (0 = +Y, 90 = +X).",
    )
    parser.add_argument(
        "--elevation",
        type=float,
        default=15.0,
        help="Camera elevation angle in degrees.",
    )
    parser.add_argument(
        "--padding",
        type=float,
        default=0.6,
        help="Extra distance padding around the model bounds.",
    )
    parser.add_argument(
        "--texture-format",
        choices=["AUTO", "PNG", "JPEG", "WEBP"],
        default="WEBP",
        help="glTF texture format (AUTO keeps originals).",
    )
    parser.add_argument(
        "--fallback-png",
        action="store_true",
        help="If WebP conversion fails, retry export with PNG textures.",
    )
    parser.add_argument("--draco", action="store_true", help="Enable Draco mesh compression.")
    parser.add_argument(
        "--draco-level",
        type=int,
        default=6,
        help="Draco compression level (0-10).",
    )
    parser.add_argument(
        "--draco-quant",
        type=int,
        default=14,
        help="Draco quantization bits.",
    )
    args = parser.parse_args()

    input_path = args.input.expanduser().resolve()
    glb_path = args.glb.expanduser().resolve()
    png_path = args.png.expanduser().resolve()
    blender_path = args.blender.expanduser().resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    if input_path.suffix.lower() != ".fbx":
        raise SystemExit("Input must be a .fbx file.")
    if not blender_path.exists():
        raise SystemExit(f"Blender executable not found: {blender_path}")

    glb_path.parent.mkdir(parents=True, exist_ok=True)
    png_path.parent.mkdir(parents=True, exist_ok=True)

    def run_blender_export(texture_format: str) -> None:
        script_body = BLENDER_SCRIPT.format(
            input_path=str(input_path),
            glb_path=str(glb_path),
            png_path=str(png_path),
            png_size=args.png_size,
            transparent=str(bool(args.transparent)),
            azimuth=args.azimuth,
            elevation=args.elevation,
            padding=args.padding,
            texture_format=texture_format,
            draco=str(bool(args.draco)),
            draco_level=args.draco_level,
            draco_quant=args.draco_quant,
        )

        with tempfile.NamedTemporaryFile("w", suffix="_fbx_to_glb_png.py", delete=False) as script_file:
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

    try:
        run_blender_export(args.texture_format)
    except subprocess.CalledProcessError:
        if args.fallback_png and args.texture_format == "WEBP":
            print("WebP export failed, retrying with PNG textures.")
            run_blender_export("PNG")
        else:
            raise

    if not glb_path.exists():
        raise SystemExit(f"GLB output not created: {glb_path}")
    if not png_path.exists():
        raise SystemExit(f"PNG output not created: {png_path}")

    print(f"Wrote {glb_path}")
    print(f"Wrote {png_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
