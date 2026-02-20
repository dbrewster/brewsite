#!/usr/bin/env python3
import argparse
import json
import math
import struct
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np


GLB_MAGIC = 0x46546C67  # b'glTF'
CHUNK_JSON = 0x4E4F534A  # b'JSON'
CHUNK_BIN = 0x004E4942  # b'BIN\0'


@dataclass
class Gltf:
    json: Dict
    bin: bytes


def read_glb(path: Path) -> Gltf:
    data = path.read_bytes()
    if len(data) < 12:
        raise ValueError("GLB file too small.")
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC:
        raise ValueError("Not a GLB file.")
    if total_length != len(data):
        raise ValueError("GLB length mismatch.")
    offset = 12
    json_chunk = None
    bin_chunk = None
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk_data = data[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == CHUNK_JSON:
            json_chunk = json.loads(chunk_data.decode("utf-8"))
        elif chunk_type == CHUNK_BIN:
            bin_chunk = chunk_data
    if json_chunk is None or bin_chunk is None:
        raise ValueError("Missing JSON or BIN chunk.")
    return Gltf(json=json_chunk, bin=bin_chunk)


def accessor_dtype(component_type: int) -> np.dtype:
    if component_type == 5126:
        return np.float32
    if component_type == 5123:
        return np.uint16
    if component_type == 5125:
        return np.uint32
    raise ValueError(f"Unsupported componentType: {component_type}")


def accessor_components(accessor_type: str) -> int:
    if accessor_type == "SCALAR":
        return 1
    if accessor_type == "VEC2":
        return 2
    if accessor_type == "VEC3":
        return 3
    if accessor_type == "VEC4":
        return 4
    raise ValueError(f"Unsupported accessor type: {accessor_type}")


def read_accessor(gltf: Gltf, accessor_index: int) -> np.ndarray:
    accessor = gltf.json["accessors"][accessor_index]
    buffer_view = gltf.json["bufferViews"][accessor["bufferView"]]
    byte_offset = buffer_view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    byte_length = buffer_view["byteLength"]
    component_type = accessor["componentType"]
    dtype = accessor_dtype(component_type)
    components = accessor_components(accessor["type"])
    count = accessor["count"]
    itemsize = np.dtype(dtype).itemsize
    stride = buffer_view.get("byteStride")
    data = gltf.bin[byte_offset:byte_offset + byte_length]
    if stride is None or stride == components * itemsize:
        array = np.frombuffer(data, dtype=dtype, count=count * components, offset=0)
        return array.reshape((count, components))
    array = np.zeros((count, components), dtype=dtype)
    for i in range(count):
        start = i * stride
        array[i] = np.frombuffer(
            data, dtype=dtype, count=components, offset=start
        )
    return array


def extract_segments(gltf: Gltf) -> List[Tuple[np.ndarray, np.ndarray]]:
    segments: List[Tuple[np.ndarray, np.ndarray]] = []
    for mesh in gltf.json.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            if mode not in (1, 2, 3):
                continue
            attrs = primitive.get("attributes", {})
            pos_accessor = attrs.get("POSITION")
            if pos_accessor is None:
                continue
            positions = read_accessor(gltf, pos_accessor)
            if "indices" in primitive:
                indices = read_accessor(gltf, primitive["indices"]).flatten()
            else:
                indices = np.arange(len(positions), dtype=np.int64)
            if mode == 1:  # LINES
                for i in range(0, len(indices) - 1, 2):
                    p0 = positions[int(indices[i])]
                    p1 = positions[int(indices[i + 1])]
                    segments.append((p0, p1))
            elif mode == 3:  # LINE_STRIP
                for i in range(0, len(indices) - 1):
                    p0 = positions[int(indices[i])]
                    p1 = positions[int(indices[i + 1])]
                    segments.append((p0, p1))
            elif mode == 2:  # LINE_LOOP
                for i in range(0, len(indices)):
                    p0 = positions[int(indices[i])]
                    p1 = positions[int(indices[(i + 1) % len(indices)])]
                    segments.append((p0, p1))
    return segments


def orthonormal_basis(direction: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    axis = direction / (np.linalg.norm(direction) + 1e-9)
    if abs(axis[0]) < 0.9:
        helper = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    else:
        helper = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    u = np.cross(axis, helper)
    u /= np.linalg.norm(u) + 1e-9
    v = np.cross(axis, u)
    v /= np.linalg.norm(v) + 1e-9
    return u, v


def build_tube_mesh(
    segments: Sequence[Tuple[np.ndarray, np.ndarray]],
    radius: float,
    radial_segments: int,
    caps: bool,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    vertices: List[np.ndarray] = []
    normals: List[np.ndarray] = []
    indices: List[int] = []

    for p0, p1 in segments:
        direction = p1 - p0
        length = float(np.linalg.norm(direction))
        if length < 1e-6:
            continue
        u, v = orthonormal_basis(direction)
        base_index = len(vertices)
        for i in range(radial_segments):
            angle = (2.0 * math.pi * i) / radial_segments
            circle = math.cos(angle) * u + math.sin(angle) * v
            vertices.append(p0 + circle * radius)
            vertices.append(p1 + circle * radius)
            normals.append(circle)
            normals.append(circle)
        for i in range(radial_segments):
            next_i = (i + 1) % radial_segments
            a = base_index + i * 2
            b = base_index + i * 2 + 1
            c = base_index + next_i * 2 + 1
            d = base_index + next_i * 2
            indices.extend([a, b, c, a, c, d])

        if caps:
            cap_start = len(vertices)
            vertices.append(p0)
            normals.append(-(direction / length))
            vertices.append(p1)
            normals.append(direction / length)
            for i in range(radial_segments):
                next_i = (i + 1) % radial_segments
                a = base_index + i * 2
                b = base_index + next_i * 2
                indices.extend([cap_start, b, a])
                c = base_index + i * 2 + 1
                d = base_index + next_i * 2 + 1
                indices.extend([cap_start + 1, c, d])

    return (
        np.array(vertices, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint32),
    )


def build_glb(vertices: np.ndarray, normals: np.ndarray, indices: np.ndarray) -> bytes:
    pos_bytes = vertices.tobytes()
    norm_bytes = normals.tobytes()
    idx_bytes = indices.tobytes()

    def pad4(blob: bytes) -> bytes:
        padding = (4 - (len(blob) % 4)) % 4
        return blob + b"\x00" * padding

    pos_offset = 0
    norm_offset = len(pos_bytes)
    idx_offset = norm_offset + len(norm_bytes)
    bin_blob = pad4(pos_bytes + norm_bytes + idx_bytes)

    def accessor_min_max(data: np.ndarray) -> Tuple[List[float], List[float]]:
        return data.min(axis=0).tolist(), data.max(axis=0).tolist()

    pos_min, pos_max = accessor_min_max(vertices)
    json_dict = {
        "asset": {"version": "2.0", "generator": "wireframe-to-solid"},
        "buffers": [{"byteLength": len(bin_blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": pos_offset, "byteLength": len(pos_bytes)},
            {"buffer": 0, "byteOffset": norm_offset, "byteLength": len(norm_bytes)},
            {"buffer": 0, "byteOffset": idx_offset, "byteLength": len(idx_bytes)},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(vertices)),
                "type": "VEC3",
                "min": pos_min,
                "max": pos_max,
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(normals)),
                "type": "VEC3",
            },
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5125,
                "count": int(len(indices)),
                "type": "SCALAR",
            },
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1},
                        "indices": 2,
                        "mode": 4,
                    }
                ]
            }
        ],
        "nodes": [{"mesh": 0}],
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }
    json_bytes = json.dumps(json_dict, separators=(",", ":")).encode("utf-8")
    json_bytes = pad4(json_bytes)

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    header = struct.pack("<III", GLB_MAGIC, 2, total_length)
    json_header = struct.pack("<II", len(json_bytes), CHUNK_JSON)
    bin_header = struct.pack("<II", len(bin_blob), CHUNK_BIN)
    return b"".join([header, json_header, json_bytes, bin_header, bin_blob])


def run_blender_remesh(
    blender_path: Path,
    input_path: Path,
    output_path: Path,
    voxel_size: float,
    adaptivity: float,
) -> None:
    blender_script = f"""
import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"{input_path}")

for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mod = obj.modifiers.new(name='Remesh', type='REMESH')
    mod.mode = 'VOXEL'
    mod.voxel_size = {voxel_size}
    mod.adaptivity = {adaptivity}
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)

bpy.ops.export_scene.gltf(filepath=r"{output_path}", export_format='GLB')
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "remesh.py"
        script_path.write_text(blender_script, encoding="utf-8")
        subprocess.run(
            [str(blender_path), "--background", "--python", str(script_path)],
            check=True,
        )


def run_trimesh_voxel_remesh(
    input_path: Path,
    output_path: Path,
    voxel_pitch: float,
) -> None:
    try:
        import trimesh
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("trimesh is not available") from exc

    scene = trimesh.load(str(input_path), force="scene")
    if isinstance(scene, trimesh.Scene):
        if not scene.geometry:
            raise RuntimeError("No geometry found in input.")
        mesh = trimesh.util.concatenate(tuple(scene.geometry.values()))
    else:
        mesh = scene

    mesh = mesh.copy()
    mesh.remove_unreferenced_vertices()
    if mesh.is_empty:
        raise RuntimeError("Mesh is empty after cleanup.")

    vox = mesh.voxelized(pitch=voxel_pitch)
    vox = vox.fill()
    solid = trimesh.voxel.ops.matrix_to_marching_cubes(vox.matrix, pitch=vox.pitch)
    solid.export(str(output_path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert wireframe GLB lines to a solid tube mesh.")
    parser.add_argument("input", type=Path, help="Path to wireframe GLB.")
    parser.add_argument("output", type=Path, help="Output GLB path.")
    parser.add_argument("--radius", type=float, default=0.01, help="Tube radius in model units.")
    parser.add_argument("--segments", type=int, default=8, help="Radial segments per tube.")
    parser.add_argument("--no-caps", action="store_true", help="Disable end caps.")
    parser.add_argument(
        "--blender",
        type=Path,
        default=None,
        help="Optional Blender executable to remesh into a solid skin.",
    )
    parser.add_argument(
        "--voxel-size",
        type=float,
        default=0.03,
        help="Blender remesh voxel size (smaller = more detail).",
    )
    parser.add_argument(
        "--adaptivity",
        type=float,
        default=0.0,
        help="Blender remesh adaptivity (0..1).",
    )
    parser.add_argument(
        "--voxel-pitch",
        type=float,
        default=0.03,
        help="Trimesh voxel pitch for solid remesh.",
    )
    args = parser.parse_args()

    gltf = read_glb(args.input)
    segments = extract_segments(gltf)
    if segments:
        vertices, normals, indices = build_tube_mesh(
            segments,
            radius=args.radius,
            radial_segments=max(3, args.segments),
            caps=not args.no_caps,
        )
        glb = build_glb(vertices, normals, indices)
        args.output.write_bytes(glb)
        print(f"Wrote {args.output} with {len(vertices)} vertices and {len(indices) // 3} triangles.")
        return

    if args.blender is not None:
        run_blender_remesh(
            args.blender,
            args.input,
            args.output,
            voxel_size=args.voxel_size,
            adaptivity=args.adaptivity,
        )
        print(f"Wrote {args.output} via Blender remesh.")
        return

    try:
        run_trimesh_voxel_remesh(
            args.input,
            args.output,
            voxel_pitch=args.voxel_pitch,
        )
        print(f"Wrote {args.output} via trimesh voxel remesh.")
        return
    except RuntimeError:
        pass

    raise RuntimeError(
        "No line segments found. The input appears to be a triangle mesh. "
        "Provide --blender to remesh into a solid skin or install trimesh."
    )


if __name__ == "__main__":
    main()
