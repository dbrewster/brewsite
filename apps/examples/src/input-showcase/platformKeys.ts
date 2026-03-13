// platformKeys.ts — Platform-aware key label mapping for display text.
// Uses `typeof navigator` guard for SSR safety.

const _isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** Whether the current platform is macOS / iOS. */
export const isMac = _isMac;

/**
 * Maps a display key string to platform-appropriate label.
 *
 * On Mac:  Ctrl → ⌃  ·  Alt → ⌥ Option  ·  Meta → ⌘  ·  Shift → ⇧
 * On Win:  unchanged
 *
 * Also maps the convenience alias "Mod" to the platform's primary modifier:
 *   Mac: ⌘   Windows: Ctrl
 */
export function pk(label: string): string {
  if (!_isMac) {
    return label.replace(/\bMod\b/g, 'Ctrl');
  }
  return label
    .replace(/\bMod\b/g, '⌘')
    .replace(/\bCtrl\b/g, '⌃')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bMeta\b/g, '⌘')
    .replace(/\bShift\b/g, '⇧')
    .replace(/\bOption\b/g, '⌥');
}
