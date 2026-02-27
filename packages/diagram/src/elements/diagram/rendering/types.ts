// Internal render-layer data structures. Not exported from package public API.

import type * as THREE from 'three';
import type { Text } from 'troika-three-text';
import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState } from '../types';

/** Extended Text type for troika layout properties not in official types. */
export type TextWithLayout = Text & {
  textAlign?: string;
  overflowWrap?: string;
  whiteSpace?: string;
  lineHeight?: number;
  textRenderInfo?: { blockBounds?: [number, number, number, number] };
};

/**
 * Live Three.js objects for one diagram node.
 * Owned by NodeRenderer; created once and mutated in-place across ticks.
 */
export type NodeRenderEntry = {
  group: THREE.Group;
  boxMesh: THREE.Mesh;
  border: THREE.LineSegments;
  roundedBorder?: THREE.LineLoop;
  glow?: THREE.Sprite;
  label: TextWithLayout;
  sublabel?: TextWithLayout;
  iconHolder?: THREE.Group;
  diagramId: string;
  materialCount: 2 | 6;
  lastState?: DiagramNodeState;
};

/**
 * Live Three.js objects for one diagram edge (tube + optional arrowheads).
 * Also used for DiagramPipes at the canvas level.
 */
export type EdgeRenderEntry = {
  group: THREE.Group;
  tube: THREE.Mesh;
  arrowStart?: THREE.Mesh;
  arrowEnd?: THREE.Mesh;
  lastState?: DiagramEdgeState | {
    id: string;
    controlPoints: ReadonlyArray<readonly [number, number, number]>;
    thickness: number;
    color: string;
    opacity: number;
    style?: 'solid' | 'dashed' | 'dotted';
    arrowStart?: string;
    arrowEnd?: string;
  };
};

/**
 * Live Three.js objects for one diagram group (fill plane + border + label).
 */
export type GroupRenderEntry = {
  group: THREE.Group;
  fill: THREE.Mesh;
  border?: THREE.LineSegments;
  label: TextWithLayout;
  lastState?: DiagramGroupState;
};
