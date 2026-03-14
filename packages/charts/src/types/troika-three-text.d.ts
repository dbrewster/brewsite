// Ambient module declaration for troika-three-text.
// The package ships no TypeScript types; this declaration satisfies tsc while
// preserving type safety at usage sites via local extensions in the renderers.
declare module 'troika-three-text' {
  import * as THREE from 'three';

  export class Text extends THREE.Mesh {
    text: string;
    font: string | undefined;
    fontSize: number;
    color: string | number;
    fillOpacity: number;
    anchorX: number | string;
    anchorY: number | string;
    maxWidth: number;
    textAlign: string;
    lineHeight: number | string;
    overflowWrap: string;
    whiteSpace: string;
    outlineWidth: number | string;
    outlineColor: string | number;
    outlineOpacity: number;
    depthOffset: number;
    renderOrder: number;
    clipRect: [number, number, number, number] | null;
    sdfGlyphSize: number;
    glyphGeometryDetail: number;
    textRenderInfo: {
      blockBounds?: [number, number, number, number];
    } | null;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
