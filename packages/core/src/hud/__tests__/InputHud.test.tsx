// Tests for the InputHud stub component.

import { describe, it, expect } from 'vitest';
import { InputHud } from '../InputHud';
import type { InputHudProps, InputHudState } from '../inputHudTypes';

const baseState: InputHudState = {
  hints: [],
  platform: 'mac',
};

describe('InputHud (stub)', () => {
  it('returns null', () => {
    const result = InputHud({ state: baseState });
    expect(result).toBeNull();
  });

  it('returns null when visible is true', () => {
    const result = InputHud({ state: baseState, visible: true });
    expect(result).toBeNull();
  });

  it('returns null when visible is false', () => {
    const result = InputHud({ state: baseState, visible: false });
    expect(result).toBeNull();
  });

  it('InputHudProps fields are correctly typed — state is required, visible is optional', () => {
    // Type-level check: compiles without visible
    const props: InputHudProps = { state: baseState };
    expect(props.state).toBe(baseState);
    expect(props.visible).toBeUndefined();
  });
});
