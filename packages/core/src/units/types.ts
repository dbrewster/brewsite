// Pure type definitions for the scene unit system — no runtime, no Three.js, no React.

/** A spatial value with explicit units. */
export type SceneLength = `${number}u` | `${number}%` | `${number}vw` | `${number}vh` | 0;

/** An angle value with explicit units. */
export type SceneAngle = `${number}deg` | `${number}rad` | 0;

/** A 2D spatial value (e.g., size, position). */
export type SceneSize2 = readonly [SceneLength, SceneLength];

/** A 3D spatial value (e.g., position with Z). */
export type ScenePosition3 = readonly [SceneLength, SceneLength, SceneLength];

/**
 * Layout padding — follows CSS shorthand.
 * 1 value: uniform. 2 values: [vertical, horizontal].
 * 3 values: [top, horizontal, bottom]. 4 values: [top, right, bottom, left].
 */
export type ScenePadding =
  | SceneLength
  | readonly [SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength, SceneLength];

/** Parsed spatial unit value — output of parseLength(), input of resolve functions. */
export type ParsedLength = { readonly value: number; readonly unit: 'u' | '%' | 'vw' | 'vh' };

/** Parsed angle unit value — output of parseAngle(). */
export type ParsedAngle = { readonly value: number; readonly unit: 'deg' | 'rad' };
