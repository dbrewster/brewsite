declare module 'troika-three-text' {
  import type * as THREE from 'three';

  export class Text extends THREE.Mesh {
    text: string;
    color: string | number;
    fontSize: number;
    maxWidth?: number;
    anchorX?: string | number;
    anchorY?: string | number;
    fillOpacity?: number;
    sync(): void;
  }
}
