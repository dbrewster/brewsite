// Consolidated types and shared Vec2/Vec3 math utilities for the 2D edge routing pipeline.

import type { DiagramEdgePathState, DiagramEdgePathDebug } from '../../types';

// ─── Side / Vector types ─────────────────────────────────────────────────────

/** Side identifier for a node in the 2D diagram plane. */
export type SideId = 'left' | 'right' | 'top' | 'bottom';

/** 2D point in the routing plane. */
export type Vec2 = readonly [number, number];

/** 3D point (XY from routing + Z from depth assignment). */
export type Vec3 = readonly [number, number, number];

// ─── Rect / Node types ───────────────────────────────────────────────────────

/** 2D axis-aligned bounding rect. */
export type Rect2D = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

/** Node bounding rect in the 2D routing plane. */
export type NodeRect = {
  readonly id: string;
  readonly cx: number;  // center X
  readonly cy: number;  // center Y
  readonly hw: number;  // half-width
  readonly hh: number;  // half-height
  readonly z: number;   // front-face Z (for depth interpolation)
  readonly depth: number; // thickness (for mid-depth Z computation)
};

// ─── Request / Result types ──────────────────────────────────────────────────

/** Edge routing request. */
export type EdgeRoutingRequest = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly profile: 'flow' | 'curved' | 'straight' | 'organic';
  readonly fromPort?: SideId;
  readonly toPort?: SideId;
  readonly thickness: number;
};

/** 2D waypoint path — output of the router, input to profiles. */
export type WaypointPath = {
  readonly sourceAnchor: Vec2;
  readonly destinationAnchor: Vec2;
  readonly sourceSide: SideId;
  readonly destinationSide: SideId;
  readonly waypoints: ReadonlyArray<Vec2>;
};

/** Final routed edge with 3D path commands. Renamed from EdgeRouteState in old pipeline. */
export type EdgeRouteResult = {
  readonly path: DiagramEdgePathState;
  readonly controlPoints: ReadonlyArray<Vec3>;
  readonly pathDebug?: DiagramEdgePathDebug;
};

// ─── Configuration types ─────────────────────────────────────────────────────

/** Flow routing configuration. */
export type FlowConfig = {
  readonly turnRadius: number;
  readonly faceStub: number;
  readonly obstaclePadding: number;
  readonly turnPenalty: number;
  readonly punchthroughPenalty: number;
  readonly bundleStrength: number;
  readonly organicVariation: number;
};

/**
 * Bundle routing hint for sibling flow edges sharing the same source node.
 * Inferred by `inferBundleHints()` and consumed by `selectSides()`.
 */
export type BundleHint = {
  readonly sourceSide: SideId;
  readonly lateralOffset: number;
  readonly sharedTrunkKey?: string;
};

/** Default flow routing configuration values. */
export const DEFAULT_FLOW_CONFIG: FlowConfig = {
  turnRadius: 0.05,
  faceStub: 0.05,
  obstaclePadding: 0.025,
  turnPenalty: 0.45,
  punchthroughPenalty: 500,
  bundleStrength: 1.0,
  organicVariation: 0.02,
};

// ─── Shared math utilities ───────────────────────────────────────────────────

/** Add two Vec2 vectors component-wise. */
export const addVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];

/** Subtract Vec2 b from Vec2 a component-wise. */
export const subVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

/** Scale a Vec2 by a scalar. */
export const scaleVec2 = (v: Vec2, s: number): Vec2 => [v[0] * s, v[1] * s];

/** Compute the Euclidean length of a Vec2. */
export const lengthVec2 = (v: Vec2): number => Math.sqrt(v[0] ** 2 + v[1] ** 2);

/** Compute the dot product of two Vec2 vectors. */
export const dotVec2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];

/** Normalize a Vec2 to unit length. Returns [0, 0] for near-zero vectors. */
export const normalizeVec2 = (v: Vec2): Vec2 => {
  const l = lengthVec2(v);
  return l < 1e-9 ? [0, 0] : [v[0] / l, v[1] / l];
};

/** Clamp a number to [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Euclidean distance between two Vec2 points. */
export const distVec2 = (a: Vec2, b: Vec2): number => lengthVec2(subVec2(a, b));

// ─── Vec3 utilities ──────────────────────────────────────────────────────────

/** Construct a Vec3 from a Vec2 XY pair and a Z value. */
export const vec3 = (xy: Vec2, z: number): Vec3 => [xy[0], xy[1], z];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps a SideId to an A* approach direction. */
export const sideToApproach = (side: SideId): 'N' | 'S' | 'E' | 'W' =>
  ({ top: 'N', bottom: 'S', left: 'W', right: 'E' } as const)[side];
