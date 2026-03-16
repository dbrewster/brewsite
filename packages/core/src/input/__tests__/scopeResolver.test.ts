// @vitest-environment jsdom
// Tests for scope resolution to DOM targets.

import { describe, it, expect } from 'vitest';
import { resolveInputTargets } from '../scopeResolver';

describe('resolveInputTargets', () => {
  it('returns window and document for window scope', () => {
    const canvas = document.createElement('div');
    const stage = document.createElement('div');
    const result = resolveInputTargets('window', canvas, stage);
    expect(result.pointerTarget).toBe(window);
    expect(result.keyboardTarget).toBe(document);
  });

  it('returns window and document for window scope even with null containers', () => {
    const result = resolveInputTargets('window', null, null);
    expect(result.pointerTarget).toBe(window);
    expect(result.keyboardTarget).toBe(document);
  });

  it('returns canvas and stage containers for canvas scope', () => {
    const canvas = document.createElement('div');
    const stage = document.createElement('div');
    const result = resolveInputTargets('canvas', canvas, stage);
    expect(result.pointerTarget).toBe(canvas);
    expect(result.keyboardTarget).toBe(stage);
  });

  it('falls back pointer target to window when canvasContainer is null', () => {
    const stage = document.createElement('div');
    const result = resolveInputTargets('canvas', null, stage);
    expect(result.pointerTarget).toBe(window);
    expect(result.keyboardTarget).toBe(stage);
  });

  it('falls back keyboard target to document when stageContainer is null', () => {
    const canvas = document.createElement('div');
    const result = resolveInputTargets('canvas', canvas, null);
    expect(result.pointerTarget).toBe(canvas);
    expect(result.keyboardTarget).toBe(document);
  });

  it('falls back both targets when both containers are null', () => {
    const result = resolveInputTargets('canvas', null, null);
    expect(result.pointerTarget).toBe(window);
    expect(result.keyboardTarget).toBe(document);
  });
});
