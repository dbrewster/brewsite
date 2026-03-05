// compile.test.ts — pure function tests for compileTextBox.
// Tests every branch: default filling and explicit overrides.

import { describe, it, expect } from 'vitest';
import { compileTextBox } from '../compile';
import type { TextBoxProps } from '../dsl';

describe('compileTextBox', () => {
  it('fills all defaults when only required fields are provided', () => {
    const props: TextBoxProps = {
      id: 'test-box',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
    expect(state.w).toBe(1);
    expect(state.h).toBe(1);
    expect(state.opacity).toBe(1);
    expect(state.anchor).toBe('scene');
    expect(state.edge).toBeUndefined();
    expect(state.inset).toBe(0);
    expect(state.overflow).toBe('hidden');
    expect(state.layer).toBe(0);
    expect(state.children).toBeNull();
  });

  it('preserves explicit x, y, w, h values over defaults', () => {
    const props: TextBoxProps = {
      id: 'positioned-box',
      x: 0.1,
      y: 0.2,
      w: 0.5,
      h: 0.4,
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.x).toBe(0.1);
    expect(state.y).toBe(0.2);
    expect(state.w).toBe(0.5);
    expect(state.h).toBe(0.4);
  });

  it('preserves explicit opacity over default', () => {
    const props: TextBoxProps = {
      id: 'semi-transparent',
      opacity: 0.75,
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.opacity).toBe(0.75);
  });

  it('preserves explicit overflow="visible" over default', () => {
    const props: TextBoxProps = {
      id: 'overflow-box',
      overflow: 'visible',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.overflow).toBe('visible');
  });

  it('preserves explicit layer over default', () => {
    const props: TextBoxProps = {
      id: 'layered-box',
      layer: 5,
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.layer).toBe(5);
  });

  it('passes children through by reference', () => {
    const content = { type: 'span', props: {}, key: null };
    const props: TextBoxProps = {
      id: 'with-children',
      children: content as unknown as import('react').ReactNode,
    };
    const state = compileTextBox(props);

    expect(state.children).toBe(content);
  });

  it('compiles anchor="viewport" with edge="top" and explicit inset', () => {
    const props: TextBoxProps = {
      id: 'viewport-top',
      anchor: 'viewport',
      edge: 'top',
      inset: 0.02,
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.anchor).toBe('viewport');
    expect(state.edge).toBe('top');
    expect(state.inset).toBe(0.02);
  });

  it('compiles anchor="viewport" with edge="bottom" and default inset', () => {
    const props: TextBoxProps = {
      id: 'viewport-bottom',
      anchor: 'viewport',
      edge: 'bottom',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.anchor).toBe('viewport');
    expect(state.edge).toBe('bottom');
    expect(state.inset).toBe(0);
  });

  it('compiles anchor="viewport" with edge="left"', () => {
    const props: TextBoxProps = {
      id: 'viewport-left',
      anchor: 'viewport',
      edge: 'left',
      inset: 0.05,
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.anchor).toBe('viewport');
    expect(state.edge).toBe('left');
    expect(state.inset).toBe(0.05);
  });

  it('compiles anchor="viewport" with edge="right"', () => {
    const props: TextBoxProps = {
      id: 'viewport-right',
      anchor: 'viewport',
      edge: 'right',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.anchor).toBe('viewport');
    expect(state.edge).toBe('right');
  });

  it('omits edge field when not provided (anchor="scene")', () => {
    const props: TextBoxProps = {
      id: 'no-edge',
      anchor: 'scene',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.edge).toBeUndefined();
  });

  it('fills inset=0 when anchor="viewport" but inset not provided', () => {
    const props: TextBoxProps = {
      id: 'no-inset',
      anchor: 'viewport',
      edge: 'top',
      children: null,
    };
    const state = compileTextBox(props);

    expect(state.inset).toBe(0);
  });
});
