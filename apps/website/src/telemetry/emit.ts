// Thin telemetry emission abstraction — swappable backend.

import type { WebsiteTelemetryEvent, TelemetryPayloadMap } from './events';

/** Signature for a telemetry emit function. */
export type TelemetryEmitFn = <E extends WebsiteTelemetryEvent>(
  event: E,
  payload: TelemetryPayloadMap[E],
) => void;

/**
 * Whether telemetry emission is enabled.
 * Defaults to true in development; override via window.__BREWSITE_TELEMETRY_ENABLED__.
 */
function isTelemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = (window as { __BREWSITE_TELEMETRY_ENABLED__?: boolean }).__BREWSITE_TELEMETRY_ENABLED__;
  return flag ?? true;
}

/**
 * Default emit implementation — structured console.info shim.
 * Replace this function body to wire a real analytics backend.
 */
const consoleEmit: TelemetryEmitFn = (event, payload) => {
  if (!isTelemetryEnabled()) return;
  // eslint-disable-next-line no-console
  console.info('[brewsite:telemetry]', event, payload);
};

/** Current emit function — reassign via `setEmitFn` to swap backend. */
let currentEmit: TelemetryEmitFn = consoleEmit;

/** Emit a telemetry event with its typed payload. */
export function emit<E extends WebsiteTelemetryEvent>(
  event: E,
  payload: TelemetryPayloadMap[E],
): void {
  currentEmit(event, payload);
}

/** Replace the telemetry emit backend at runtime. */
export function setEmitFn(fn: TelemetryEmitFn): void {
  currentEmit = fn;
}

/** Reset emit to the default console shim (useful in tests). */
export function resetEmitFn(): void {
  currentEmit = consoleEmit;
}
