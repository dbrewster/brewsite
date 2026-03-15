// platformKeys.ts — Platform detection and modifier-key formatting utilities.

import type { ModifierKey } from './types';
import type { InputActionMap } from './types';

/** Platform identifier. */
export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

/**
 * Detects the current platform from the navigator object.
 * Returns 'unknown' in SSR or when navigator is unavailable.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent ?? '';
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform ?? '';
  if (/mac/i.test(platform)) return 'mac';
  if (/win/i.test(platform) || /win/i.test(ua)) return 'windows';
  if (/linux/i.test(platform) || /linux/i.test(ua)) return 'linux';
  return 'unknown';
}

/** Human-readable modifier labels per platform. */
const MODIFIER_LABELS: Record<Platform, Record<ModifierKey, string>> = {
  mac:     { alt: '⌥', ctrl: '⌃', meta: '⌘', shift: '⇧' },
  windows: { alt: 'Alt', ctrl: 'Ctrl', meta: 'Win', shift: 'Shift' },
  linux:   { alt: 'Alt', ctrl: 'Ctrl', meta: 'Super', shift: 'Shift' },
  unknown: { alt: 'Alt', ctrl: 'Ctrl', meta: 'Meta', shift: 'Shift' },
};

/** Human-readable key labels for special keys. */
const KEY_LABELS: Record<string, Record<Platform, string>> = {
  ArrowUp:    { mac: '↑', windows: '↑', linux: '↑', unknown: '↑' },
  ArrowDown:  { mac: '↓', windows: '↓', linux: '↓', unknown: '↓' },
  ArrowLeft:  { mac: '←', windows: '←', linux: '←', unknown: '←' },
  ArrowRight: { mac: '→', windows: '→', linux: '→', unknown: '→' },
  ' ':        { mac: 'Space', windows: 'Space', linux: 'Space', unknown: 'Space' },
  Enter:      { mac: '↩', windows: 'Enter', linux: 'Enter', unknown: 'Enter' },
  Escape:     { mac: 'Esc', windows: 'Esc', linux: 'Esc', unknown: 'Esc' },
  Backspace:  { mac: '⌫', windows: 'Backspace', linux: 'Backspace', unknown: 'Backspace' },
  Delete:     { mac: '⌦', windows: 'Del', linux: 'Del', unknown: 'Del' },
  Tab:        { mac: '⇥', windows: 'Tab', linux: 'Tab', unknown: 'Tab' },
};

/**
 * Formats a single modifier key for the given platform.
 * Example: formatModifier('meta', 'mac') → '⌘'
 */
export function formatModifier(mod: ModifierKey, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  return MODIFIER_LABELS[p][mod];
}

/**
 * Formats a key name for human display.
 * Example: formatKey('ArrowUp', 'mac') → '↑', formatKey('r', 'mac') → 'R'
 */
export function formatKey(key: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const label = KEY_LABELS[key]?.[p];
  if (label) return label;
  // Single character keys are uppercased for display.
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Formats a full key combo (modifiers + key) for human display.
 * Example: formatKeyCombo({ key: 'r', modifiers: ['meta'] }, 'mac') → '⌘R'
 */
export function formatKeyCombo(
  combo: { key: string; modifiers?: ModifierKey[] },
  platform?: Platform,
): string {
  const p = platform ?? detectPlatform();
  const modParts = (combo.modifiers ?? []).map((m) => formatModifier(m, p));
  const keyPart = formatKey(combo.key, p);
  // Mac uses no separator between modifiers and key; others use '+'.
  const separator = p === 'mac' ? '' : '+';
  return [...modParts, keyPart].join(separator);
}

/**
 * Formats an InputActionMap for human display.
 * Returns a human-readable string describing the input gesture.
 *
 * Examples:
 *   { kind: 'key', key: 'ArrowDown' } → '↓'
 *   { kind: 'pointer', event: 'drag', button: 'left' } → 'Left Drag'
 *   { kind: 'pinch', direction: 'both' } → 'Pinch'
 *   { kind: 'wheel' } → 'Scroll'
 */
export function formatInputMap(map: InputActionMap, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const modPrefix = ('modifiers' in map && map.modifiers && map.modifiers.length > 0)
    ? map.modifiers.map((m) => formatModifier(m, p)).join(p === 'mac' ? '' : '+') + (p === 'mac' ? '' : '+')
    : '';

  switch (map.kind) {
    case 'key':
      return modPrefix + formatKey(map.key, p);
    case 'pointer': {
      const button = map.button ?? 'left';
      const buttonLabel = button === 'left' ? 'Left' : button === 'middle' ? 'Middle' : 'Right';
      const event = map.event === 'drag' ? 'Drag' : 'Click';
      return modPrefix + `${buttonLabel} ${event}`;
    }
    case 'wheel':
      return modPrefix + 'Scroll';
    case 'pinch':
      return modPrefix + 'Pinch';
  }
}
