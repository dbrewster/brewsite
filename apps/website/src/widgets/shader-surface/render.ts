// Three.js renderer for the shader surface widget.

import * as THREE from 'three';
import type { NVSCoordService } from '@brewsite/core/widget/types';
import type { ShaderSurfaceState } from './types';

/** Palette color map for shader surface elements. */
const PALETTE_COLORS: Record<ShaderSurfaceState['palette'], [number, number, number]> = {
  hero: [0.0, 0.847, 1.0],     // #00d8ff
  violet: [0.545, 0.361, 0.965], // #8b5cf6
  warm: [1.0, 0.6, 0.2],        // #ff9933
  aurora: [0.133, 0.773, 0.369], // #22c55e
};

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uDistortion;
  uniform float uEdgeGlow;
  uniform float uScanStrength;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Distortion wave
    float wave = sin(uv.y * 10.0 + uTime * 2.0) * uDistortion * 0.05;
    uv.x += wave;

    // Base gradient
    float gradient = smoothstep(0.0, 1.0, uv.y);

    // Edge glow effect
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edge = (1.0 - smoothstep(0.0, 0.15, edgeDist)) * uEdgeGlow;

    // Scan line effect
    float scan = sin(uv.y * 80.0 + uTime * 3.0) * 0.5 + 0.5;
    scan = scan * uScanStrength * 0.15;

    // Reveal mask (wipe from bottom to top)
    float revealMask = smoothstep(1.0 - uReveal, 1.0 - uReveal + 0.05, uv.y);
    revealMask = mix(revealMask, 1.0, step(0.99, uReveal));

    float alpha = (gradient * 0.3 + edge + scan) * uOpacity * revealMask;
    vec3 color = uColor * (1.0 + edge * 0.5);

    gl_FragColor = vec4(color, alpha);
  }
`;

export class ShaderSurfaceRenderer {
  private scene: THREE.Scene;
  private root: THREE.Group | null = null;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(state: ShaderSurfaceState, wallTimeSeconds: number, coords: NVSCoordService): void {
    if (!this.root) this.createRoot();
    if (!this.root) return;

    const opacity = Math.max(0, Math.min(1, state.opacity));
    this.root.visible = state.enabled && opacity > 0.001;
    if (!this.root.visible) return;

    // Ensure mesh exists
    if (!this.mesh) this.createMesh();
    if (!this.mesh || !this.material) return;

    // Convert NVS to world coordinates
    const centerX = state.x + state.w / 2;
    const centerY = state.y + state.h / 2;
    const [worldX, worldY] = coords.toWorld(centerX, centerY, state.z);
    const [worldW, worldH] = coords.toWorldSize(state.w, state.h);

    this.root.position.set(worldX, worldY, state.z);
    this.root.scale.set(worldW, worldH, 1);

    // Update uniforms
    const paletteColor = PALETTE_COLORS[state.palette] ?? PALETTE_COLORS.hero;
    this.material.uniforms.uTime.value = wallTimeSeconds;
    this.material.uniforms.uOpacity.value = opacity;
    this.material.uniforms.uReveal.value = state.reveal;
    this.material.uniforms.uDistortion.value = state.distortion;
    this.material.uniforms.uEdgeGlow.value = state.edgeGlow;
    this.material.uniforms.uScanStrength.value = state.scanStrength;
    this.material.uniforms.uColor.value.set(paletteColor[0], paletteColor[1], paletteColor[2]);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.removeFromParent();
    }
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.root) {
      this.root.removeFromParent();
      this.root = null;
    }
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }

  private createRoot(): void {
    this.root = new THREE.Group();
    this.scene.add(this.root);
  }

  private createMesh(): void {
    this.geometry = new THREE.PlaneGeometry(1, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.4 },
        uReveal: { value: 1 },
        uDistortion: { value: 0.1 },
        uEdgeGlow: { value: 0.2 },
        uScanStrength: { value: 0 },
        uColor: { value: new THREE.Vector3(0, 0.847, 1.0) },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.root?.add(this.mesh);
  }
}
