// Three.js renderer for the signal field particle system.

import * as THREE from 'three';
import type { NVSCoordService } from '@brewsite/core/widget/types';
import type { SignalFieldState } from './types';

/** Palette color map for signal field particles. */
const PALETTE_COLORS: Record<SignalFieldState['palette'], THREE.Color> = {
  hero: new THREE.Color(0x00d8ff),
  violet: new THREE.Color(0x8b5cf6),
  warm: new THREE.Color(0xff9933),
  aurora: new THREE.Color(0x22c55e),
};

/** Maximum particle count to prevent excessive memory allocation. */
const MAX_PARTICLES = 1000;

export class SignalFieldRenderer {
  private scene: THREE.Scene;
  private root: THREE.Group | null = null;
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.PointsMaterial | null = null;
  private seeds: Float32Array | null = null;
  private phases: Float32Array | null = null;
  private currentCount = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(state: SignalFieldState, wallTimeSeconds: number, coords: NVSCoordService): void {
    if (!this.root) this.createRoot();
    if (!this.root) return;

    const opacity = Math.max(0, Math.min(1, state.opacity));
    this.root.visible = state.enabled && opacity > 0.001;
    if (!this.root.visible) return;

    const count = Math.min(Math.max(0, Math.floor(state.count)), MAX_PARTICLES);

    // Rebuild particle buffers if count changed
    if (count !== this.currentCount) {
      this.rebuildParticles(count);
    }

    if (!this.geometry || !this.material || !this.seeds || !this.phases) return;

    // Update material
    const paletteColor = PALETTE_COLORS[state.palette] ?? PALETTE_COLORS.hero;
    this.material.color.copy(paletteColor);
    this.material.opacity = opacity;
    this.material.size = state.size * 10; // Scale for visibility

    // Convert NVS bounds to world-space
    const centerX = state.x + state.w / 2;
    const centerY = state.y + state.h / 2;
    const [worldCX, worldCY] = coords.toWorld(centerX, centerY, state.z);
    const [worldW, worldH] = coords.toWorldSize(state.w, state.h);
    const halfW = worldW / 2;
    const halfH = worldH / 2;
    const spreadDepth = state.depth * coords.visibleWorldWidth;

    // Update particle positions based on flow type and time
    const positions = this.geometry.attributes.position.array as Float32Array;
    const time = wallTimeSeconds * state.speed;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const seed = this.seeds[i];
      const phase = this.phases[i];
      const angle = time * (0.3 + seed * 0.7) + phase;

      let px: number;
      let py: number;
      let pz: number;

      switch (state.flow) {
        case 'orbit':
          px = worldCX + Math.cos(angle) * halfW * state.spread * (0.3 + seed * 0.7);
          py = worldCY + Math.sin(angle * 1.3) * halfH * state.spread * (0.3 + seed * 0.7);
          pz = state.z + Math.sin(angle * 0.7 + phase) * spreadDepth;
          break;
        case 'stream':
          px = worldCX + (seed - 0.5) * worldW * state.spread;
          py = worldCY + halfH - ((time * 0.5 + phase) % 1) * worldH;
          pz = state.z + (seed - 0.5) * spreadDepth;
          break;
        case 'assemble': {
          const bias = state.targetBias;
          const randomX = worldCX + (seed - 0.5) * worldW * state.spread;
          const randomY = worldCY + (phase / (Math.PI * 2) - 0.5) * worldH * state.spread;
          px = randomX + (worldCX - randomX) * bias;
          py = randomY + (worldCY - randomY) * bias;
          pz = state.z + (seed - 0.5) * spreadDepth * (1 - bias);
          break;
        }
        case 'dissolve':
          px = worldCX + (seed - 0.5) * worldW * state.spread * (1 + time * 0.1);
          py = worldCY + (phase / (Math.PI * 2) - 0.5) * worldH * state.spread * (1 + time * 0.1);
          pz = state.z + Math.sin(phase + time) * spreadDepth * (1 + time * 0.05);
          break;
      }

      positions[i3] = px;
      positions[i3 + 1] = py;
      positions[i3 + 2] = pz;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    if (this.points) {
      this.points.removeFromParent();
    }
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.root) {
      this.root.removeFromParent();
      this.root = null;
    }
    this.points = null;
    this.geometry = null;
    this.material = null;
    this.seeds = null;
    this.phases = null;
    this.currentCount = 0;
  }

  private createRoot(): void {
    this.root = new THREE.Group();
    this.scene.add(this.root);
  }

  private rebuildParticles(count: number): void {
    // Dispose old
    if (this.points) {
      this.points.removeFromParent();
    }
    this.geometry?.dispose();
    this.material?.dispose();

    if (count === 0) {
      this.points = null;
      this.geometry = null;
      this.material = null;
      this.seeds = null;
      this.phases = null;
      this.currentCount = 0;
      return;
    }

    // Generate deterministic seeds and phases
    this.seeds = new Float32Array(count);
    this.phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Simple deterministic hash for repeatable layouts
      this.seeds[i] = ((i * 2654435761) >>> 0) / 4294967296;
      this.phases[i] = ((i * 340573321) >>> 0) / 4294967296 * Math.PI * 2;
    }

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create material
    this.material = new THREE.PointsMaterial({
      color: 0x00d8ff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.root?.add(this.points);
    this.currentCount = count;
  }
}
