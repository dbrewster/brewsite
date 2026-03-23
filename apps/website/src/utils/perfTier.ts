// Deterministic performance tier resolution based on device capabilities.

/** Performance tier classification for the website. */
export type PerfTier = 'high' | 'medium' | 'low';

/**
 * Input for perf tier resolution.
 * All fields are optional or derived from browser APIs.
 */
export type PerfTierInput = {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly isMobile: boolean;
};

/**
 * Resolves a deterministic PerfTier from device capability signals.
 *
 * Heuristic:
 * - Low: mobile with <=4 cores or <=4GB memory
 * - High: desktop with >=8 cores and >=8GB memory
 * - Medium: everything else
 */
export function resolvePerfTier(input: PerfTierInput): PerfTier {
  const cores = input.hardwareConcurrency ?? 4;
  const memory = input.deviceMemory ?? 4;

  if (input.isMobile && (cores <= 4 || memory <= 4)) {
    return 'low';
  }

  if (!input.isMobile && cores >= 8 && memory >= 8) {
    return 'high';
  }

  return 'medium';
}
