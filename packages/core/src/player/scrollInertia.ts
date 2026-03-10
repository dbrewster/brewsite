// scrollInertia.ts — Pure spring-inertia math functions, testable without DOM.

/**
 * Computes a single inertia integrator step.
 *
 * Applies accumulated wheel delta to velocity, decays velocity by the
 * inertiaDecay factor, advances progress, and clamps velocity at boundaries
 * to prevent stuck accumulation.
 *
 * @param velocity          Current velocity in engine-progress-per-frame units.
 * @param pendingDelta      Accumulated wheel delta since the last tick (caller clears this).
 * @param inertiaSensitivity  Wheel delta → velocity multiplier.
 * @param inertiaDecay      Per-frame velocity decay factor [0.5, 0.99].
 * @param currentProgress   Current engine progress [0, 1].
 * @returns Updated velocity and progress values.
 */
export function computeInertiaStep(
  velocity: number,
  pendingDelta: number,
  inertiaSensitivity: number,
  inertiaDecay: number,
  currentProgress: number,
): { velocity: number; progress: number } {
  // Step 1: Apply accumulated wheel delta to velocity, then decay
  const newVelocity = (velocity + pendingDelta * inertiaSensitivity) * inertiaDecay;

  // Step 2: Advance progress
  const newProgress = Math.max(0, Math.min(1, currentProgress + newVelocity));

  // Step 3: Clamp velocity at boundaries to prevent stuck positive/negative accumulation
  const clampedVelocity = (newProgress <= 0 || newProgress >= 1) ? 0 : newVelocity;

  return { velocity: clampedVelocity, progress: newProgress };
}
