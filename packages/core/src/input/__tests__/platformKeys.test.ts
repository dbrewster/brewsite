import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  formatModifier,
  formatKey,
  formatKeyCombo,
  formatInputMap,
} from '../platformKeys';

// detectPlatform tests run in Node (no navigator) — always returns 'unknown'.

describe('detectPlatform', () => {
  it('returns "unknown" when navigator is undefined (SSR)', () => {
    // Temporarily remove the navigator global to simulate SSR.
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true });
    try {
      expect(detectPlatform()).toBe('unknown');
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'navigator', descriptor);
      }
    }
  });

  it('returns a valid platform string when navigator is defined', () => {
    const result = detectPlatform();
    expect(['mac', 'windows', 'linux', 'unknown']).toContain(result);
  });
});

describe('formatModifier', () => {
  it('returns ⌘ for meta on mac', () => {
    expect(formatModifier('meta', 'mac')).toBe('⌘');
  });

  it('returns ⌥ for alt on mac', () => {
    expect(formatModifier('alt', 'mac')).toBe('⌥');
  });

  it('returns ⌃ for ctrl on mac', () => {
    expect(formatModifier('ctrl', 'mac')).toBe('⌃');
  });

  it('returns ⇧ for shift on mac', () => {
    expect(formatModifier('shift', 'mac')).toBe('⇧');
  });

  it('returns Ctrl for ctrl on windows', () => {
    expect(formatModifier('ctrl', 'windows')).toBe('Ctrl');
  });

  it('returns Alt for alt on windows', () => {
    expect(formatModifier('alt', 'windows')).toBe('Alt');
  });

  it('returns Win for meta on windows', () => {
    expect(formatModifier('meta', 'windows')).toBe('Win');
  });

  it('returns Shift for shift on windows', () => {
    expect(formatModifier('shift', 'windows')).toBe('Shift');
  });

  it('returns Super for meta on linux', () => {
    expect(formatModifier('meta', 'linux')).toBe('Super');
  });

  it('returns Meta for meta on unknown', () => {
    expect(formatModifier('meta', 'unknown')).toBe('Meta');
  });
});

describe('formatKey', () => {
  it('formats ArrowUp as ↑ on mac', () => {
    expect(formatKey('ArrowUp', 'mac')).toBe('↑');
  });

  it('formats ArrowDown as ↓ on mac', () => {
    expect(formatKey('ArrowDown', 'mac')).toBe('↓');
  });

  it('formats ArrowLeft as ← on mac', () => {
    expect(formatKey('ArrowLeft', 'mac')).toBe('←');
  });

  it('formats ArrowRight as → on mac', () => {
    expect(formatKey('ArrowRight', 'mac')).toBe('→');
  });

  it('formats ArrowUp as ↑ on windows', () => {
    expect(formatKey('ArrowUp', 'windows')).toBe('↑');
  });

  it('formats single-char key as uppercase', () => {
    expect(formatKey('r', 'mac')).toBe('R');
    expect(formatKey('r', 'windows')).toBe('R');
  });

  it('formats Enter as ↩ on mac', () => {
    expect(formatKey('Enter', 'mac')).toBe('↩');
  });

  it('formats Enter as Enter on windows', () => {
    expect(formatKey('Enter', 'windows')).toBe('Enter');
  });

  it('formats Escape as Esc on all platforms', () => {
    expect(formatKey('Escape', 'mac')).toBe('Esc');
    expect(formatKey('Escape', 'windows')).toBe('Esc');
  });

  it('formats Backspace as ⌫ on mac', () => {
    expect(formatKey('Backspace', 'mac')).toBe('⌫');
  });

  it('formats Backspace as Backspace on windows', () => {
    expect(formatKey('Backspace', 'windows')).toBe('Backspace');
  });

  it('returns the key as-is for unknown multi-char keys', () => {
    expect(formatKey('F12', 'mac')).toBe('F12');
    expect(formatKey('PageUp', 'windows')).toBe('PageUp');
  });
});

describe('formatKeyCombo', () => {
  it('formats single key with no modifiers on mac', () => {
    expect(formatKeyCombo({ key: 'r' }, 'mac')).toBe('R');
  });

  it('formats meta+key with no separator on mac', () => {
    expect(formatKeyCombo({ key: 'r', modifiers: ['meta'] }, 'mac')).toBe('⌘R');
  });

  it('formats ctrl+key with + separator on windows', () => {
    expect(formatKeyCombo({ key: 'r', modifiers: ['ctrl'] }, 'windows')).toBe('Ctrl+R');
  });

  it('formats shift+meta on mac with no separator', () => {
    expect(formatKeyCombo({ key: 'r', modifiers: ['shift', 'meta'] }, 'mac')).toBe('⇧⌘R');
  });

  it('formats shift+ctrl on windows with + separator', () => {
    expect(formatKeyCombo({ key: 'r', modifiers: ['shift', 'ctrl'] }, 'windows')).toBe('Shift+Ctrl+R');
  });

  it('formats arrow key combo on mac', () => {
    expect(formatKeyCombo({ key: 'ArrowDown', modifiers: ['meta'] }, 'mac')).toBe('⌘↓');
  });
});

describe('formatInputMap', () => {
  it('formats key map with arrow key', () => {
    expect(formatInputMap({ kind: 'key', key: 'ArrowDown' }, 'mac')).toBe('↓');
  });

  it('formats key map with letter key', () => {
    expect(formatInputMap({ kind: 'key', key: 'r' }, 'mac')).toBe('R');
  });

  it('formats key map with modifiers on mac', () => {
    expect(formatInputMap({ kind: 'key', key: 'r', modifiers: ['meta'] }, 'mac')).toBe('⌘R');
  });

  it('formats key map with modifiers on windows', () => {
    expect(formatInputMap({ kind: 'key', key: 'r', modifiers: ['ctrl'] }, 'windows')).toBe('Ctrl+R');
  });

  it('formats pointer left drag', () => {
    expect(formatInputMap({ kind: 'pointer', event: 'drag', button: 'left' }, 'mac')).toBe('Left Drag');
  });

  it('formats pointer right drag', () => {
    expect(formatInputMap({ kind: 'pointer', event: 'drag', button: 'right' }, 'mac')).toBe('Right Drag');
  });

  it('formats pointer middle drag', () => {
    expect(formatInputMap({ kind: 'pointer', event: 'drag', button: 'middle' }, 'mac')).toBe('Middle Drag');
  });

  it('formats pointer click', () => {
    expect(formatInputMap({ kind: 'pointer', event: 'click', button: 'left' }, 'mac')).toBe('Left Click');
  });

  it('formats pointer drag with shift modifier on mac', () => {
    expect(
      formatInputMap({ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'] }, 'mac'),
    ).toBe('⇧Left Drag');
  });

  it('formats pointer drag with shift modifier on windows', () => {
    expect(
      formatInputMap({ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'] }, 'windows'),
    ).toBe('Shift+Left Drag');
  });

  it('formats wheel map as Scroll', () => {
    expect(formatInputMap({ kind: 'wheel' }, 'mac')).toBe('Scroll');
  });

  it('formats wheel map with modifier on mac', () => {
    expect(formatInputMap({ kind: 'wheel', modifiers: ['meta'] }, 'mac')).toBe('⌘Scroll');
  });

  it('formats wheel map with modifier on windows', () => {
    expect(formatInputMap({ kind: 'wheel', modifiers: ['ctrl'] }, 'windows')).toBe('Ctrl+Scroll');
  });

  it('formats pinch map as Pinch', () => {
    expect(formatInputMap({ kind: 'pinch', direction: 'both' }, 'mac')).toBe('Pinch');
  });

  it('formats pointer with no explicit button defaults to Left', () => {
    expect(formatInputMap({ kind: 'pointer', event: 'drag' }, 'mac')).toBe('Left Drag');
  });
});
