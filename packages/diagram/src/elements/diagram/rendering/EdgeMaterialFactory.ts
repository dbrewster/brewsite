// Material and pattern texture factory for diagram edges.
import * as THREE from 'three';

export interface IEdgeMaterialFactory {
  createMaterial(
    color: string,
    opacity: number,
    style: 'solid' | 'dashed' | 'dotted',
    metalness: number,
    roughness: number,
  ): THREE.Material;
  disposeTextures(): void;
}

const createCanvas = (size: number): HTMLCanvasElement => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size) as unknown as HTMLCanvasElement;
  }
  return { width: size, height: size, getContext: () => null } as unknown as HTMLCanvasElement;
};

export class EdgeMaterialFactory implements IEdgeMaterialFactory {
  private dashTexture: THREE.CanvasTexture | null = null;
  private dotTexture: THREE.CanvasTexture | null = null;

  createMaterial(
    color: string,
    opacity: number,
    style: 'solid' | 'dashed' | 'dotted',
    metalness: number,
    roughness: number,
  ): THREE.Material {
    if (style === 'solid') {
      return new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        transparent: true,
        opacity,
      });
    }
    const map = style === 'dashed' ? this.getDashTexture() : this.getDotTexture();
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      transparent: true,
      opacity,
      map,
    });
    return material;
  }

  disposeTextures(): void {
    this.dashTexture?.dispose();
    this.dotTexture?.dispose();
    this.dashTexture = null;
    this.dotTexture = null;
  }

  private getDashTexture(): THREE.CanvasTexture {
    if (this.dashTexture) return this.dashTexture;
    const size = 64;
    const canvas = createCanvas(size);
    const ctx = canvas.getContext?.('2d') ?? null;
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'black';
      ctx.fillRect(size * 0.5, 0, size * 0.5, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 1);
    this.dashTexture = texture;
    return texture;
  }

  private getDotTexture(): THREE.CanvasTexture {
    if (this.dotTexture) return this.dotTexture;
    const size = 32;
    const canvas = createCanvas(size);
    const ctx = canvas.getContext?.('2d') ?? null;
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 1);
    this.dotTexture = texture;
    return texture;
  }
}
