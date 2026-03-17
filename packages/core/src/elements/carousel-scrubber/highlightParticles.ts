// Pure math functions for smoke ring particle animation.
// Three.js particle construction lives in render.ts; this module
// provides only the testable position/lifecycle math.

/** Per-particle state stored in a flat structure-of-arrays layout. */
export type ParticleState = {
  /** Current angle in radians around the ring. */
  angle: number;
  /** Current Y offset above the ring base. */
  yOffset: number;
  /** Current age in seconds. */
  age: number;
  /** Angular speed in radians/second. */
  angularSpeed: number;
  /** Upward drift speed in world units/second. */
  driftSpeed: number;
  /** Total lifetime in seconds before recycling. */
  lifetime: number;
};

/** Default particle count for smoke rings. */
export const DEFAULT_PARTICLE_COUNT = 64;

/** Default particle lifetime range [min, max] in seconds. */
export const LIFETIME_RANGE: readonly [number, number] = [1.5, 3.0];

/** Default angular speed range [min, max] in radians/second. */
export const ANGULAR_SPEED_RANGE: readonly [number, number] = [0.2, 0.6];

/** Default upward drift speed range [min, max] in world units/second. */
export const DRIFT_SPEED_RANGE: readonly [number, number] = [0.05, 0.15];

/**
 * Initializes a single particle with randomized properties.
 * Uses a deterministic seed function for testability.
 *
 * @param random - A function returning a value in [0, 1), like Math.random.
 */
export function initParticle(random: () => number): ParticleState {
  return {
    angle: random() * Math.PI * 2,
    yOffset: 0,
    age: random() * LIFETIME_RANGE[1], // stagger initial ages
    angularSpeed: ANGULAR_SPEED_RANGE[0] + random() * (ANGULAR_SPEED_RANGE[1] - ANGULAR_SPEED_RANGE[0]),
    driftSpeed: DRIFT_SPEED_RANGE[0] + random() * (DRIFT_SPEED_RANGE[1] - DRIFT_SPEED_RANGE[0]),
    lifetime: LIFETIME_RANGE[0] + random() * (LIFETIME_RANGE[1] - LIFETIME_RANGE[0]),
  };
}

/**
 * Advances a particle by dt seconds. If the particle's age exceeds its
 * lifetime, it is recycled (reset to base position with a new random angle).
 *
 * Pure function — returns a new ParticleState.
 *
 * @param particle - Current particle state.
 * @param dt - Delta time in seconds.
 * @param random - A function returning a value in [0, 1), used for recycling.
 * @returns Updated particle state.
 */
export function advanceParticle(
  particle: ParticleState,
  dt: number,
  random: () => number,
): ParticleState {
  const newAge = particle.age + dt;

  if (newAge >= particle.lifetime) {
    // Recycle: reset to ring base with new random angle
    return {
      angle: random() * Math.PI * 2,
      yOffset: 0,
      age: 0,
      angularSpeed: ANGULAR_SPEED_RANGE[0] + random() * (ANGULAR_SPEED_RANGE[1] - ANGULAR_SPEED_RANGE[0]),
      driftSpeed: DRIFT_SPEED_RANGE[0] + random() * (DRIFT_SPEED_RANGE[1] - DRIFT_SPEED_RANGE[0]),
      lifetime: LIFETIME_RANGE[0] + random() * (LIFETIME_RANGE[1] - LIFETIME_RANGE[0]),
    };
  }

  return {
    ...particle,
    angle: particle.angle + particle.angularSpeed * dt,
    yOffset: particle.yOffset + particle.driftSpeed * dt,
    age: newAge,
  };
}

/**
 * Computes the world-space XZ position of a particle on the ring.
 *
 * @param angle - Particle angle in radians.
 * @param radius - Ring radius in world units.
 * @returns [x, z] position tuple.
 */
export function particleRingPosition(angle: number, radius: number): [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/**
 * Computes particle opacity based on its age/lifetime ratio.
 * Fades in over the first 10% and fades out over the last 30%.
 *
 * @param age - Current age in seconds.
 * @param lifetime - Total lifetime in seconds.
 * @returns Opacity in [0, 1].
 */
export function particleOpacity(age: number, lifetime: number): number {
  if (lifetime <= 0) return 0;
  const t = age / lifetime;
  // Fade in: 0 -> 1 over [0, 0.1]
  const fadeIn = Math.min(t / 0.1, 1.0);
  // Fade out: 1 -> 0 over [0.7, 1.0]
  const fadeOut = 1.0 - Math.max((t - 0.7) / 0.3, 0.0);
  return fadeIn * fadeOut;
}
