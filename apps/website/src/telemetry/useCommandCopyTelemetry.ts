// Hook that returns a callback for emitting cta_copy_command telemetry.

import { useCallback } from 'react';
import { emit } from './emit';

/**
 * Returns a stable callback that emits `cta_copy_command` telemetry.
 * Pass the returned function as the `onCopy` prop to CommandCard.
 */
export function useCommandCopyTelemetry(): (command: string) => void {
  return useCallback((command: string) => {
    emit('cta_copy_command', { command });
  }, []);
}
