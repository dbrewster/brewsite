// Device capability detection for the website.

/**
 * Detected device capabilities for effect gating decisions.
 */
export type DeviceCapabilities = {
  readonly hardwareConcurrency: number;
  readonly deviceMemory: number;
  readonly isMobile: boolean;
  readonly supportsWebGL2: boolean;
};

/**
 * Detects device capabilities from browser APIs.
 * Safe to call in SSR — returns conservative defaults when window is unavailable.
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      hardwareConcurrency: 4,
      deviceMemory: 4,
      isMobile: false,
      supportsWebGL2: false,
    };
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.innerWidth < 768;

  const supportsWebGL2 = (() => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('webgl2');
      return ctx !== null;
    } catch {
      return false;
    }
  })();

  return {
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory ?? 4,
    isMobile,
    supportsWebGL2,
  };
}
