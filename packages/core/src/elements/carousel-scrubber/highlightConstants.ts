// Single source of truth for all highlight-related runtime constants.
// Imported by compileTray.ts (compile-time defaults) and render.ts (render-time defaults).
// Extracted from types.ts to keep that file as pure type contracts.

// ─── Compile + render shared defaults ────────────────────────────────────────

/** Default glow highlight intensity [0-1]. */
export const HL_DEFAULT_GLOW_INTENSITY = 0.8;
/** Default holographic highlight intensity [0-1]. */
export const HL_DEFAULT_HOLOGRAPHIC_INTENSITY = 0.5;
/** Default beam height in world units. */
export const HL_DEFAULT_BEAM_HEIGHT = 5.0;
/** Default backdrop opacity [0-1]. 0 = no backdrop. */
export const HL_DEFAULT_BACKDROP_OPACITY = 0.5;
/** Default backdrop color for dark (additive) scenes — black dim. */
export const HL_DEFAULT_BACKDROP_COLOR_DARK = '#000000';
/** Default backdrop color for light (normal) scenes — smokey warm white. */
export const HL_DEFAULT_BACKDROP_COLOR_LIGHT = '#e8e4e0';

// ─── Render-only constants ───────────────────────────────────────────────────

/** Opacity LERP factor per frame for highlight fade transitions. */
export const HL_FADE_LERP = 0.15;
/** Position LERP factor per frame — matches ViewWidget for smooth tracking. */
export const HL_POSITION_LERP = 0.12;
/** Opacity below this threshold hides the highlight. */
export const HL_OPACITY_THRESHOLD = 0.01;
/** World-unit offset above the tray surface for highlight placement. */
export const HL_Y_OFFSET = 0.25;

/** Beam ellipse X/Z scale relative to view width/height. 0.7 = 140% diameter. */
export const HL_BEAM_SCALE = 0.7;
/** Z-axis squeeze factor for beam/backdrop ellipsis. 0.7 = 30% thinner in depth. */
export const HL_BEAM_Z_SQUEEZE = 0.7;
/** Glow plane scale relative to view width/height. */
export const HL_GLOW_SCALE = 1.4;
/** Surface glow intensity multiplier for holographic mode (relative to hl.intensity). */
export const HL_HOLOGRAPHIC_GLOW_FACTOR = 0.15;
/** Glow-mode plane size factor (relative to view width/height). */
export const HL_GLOW_MODE_SCALE = 1;
/** Backdrop cylinder scale relative to beam. Matches beam exactly — no gap. */
export const HL_BACKDROP_SCALE = 1.0;

/** Number of volumetric dust motes inside the beam. */
export const HL_DUST_PARTICLE_COUNT = 128;
/** Dust mote point size in world units. */
export const HL_DUST_POINT_SIZE = 0.04;
/** Dust mote base opacity [0-1]. */
export const HL_DUST_OPACITY = 0.5;
/** Smoke ring base opacity [0-1]. */
export const HL_SMOKE_OPACITY = 0.9;
/** Smoke ring particle size. */
export const HL_SMOKE_POINT_SIZE = 0.05;
