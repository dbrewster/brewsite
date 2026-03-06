// Tests for dslSourceInfo utilities — pure functions, no renderer.

import { describe, it, expect } from 'vitest';
import React from 'react';
import type { ReactElement } from 'react';
import type { DslBreadcrumb } from '../sceneTrackTypes';
import {
  buildBreadcrumb,
  formatBreadcrumbChain,
  getComponentName,
  getElementKey,
  formatSourceLocation,
} from '../dslSourceInfo';

// A DSL component with a displayName, used to verify name extraction.
const TextBox = (_props: { x: number; y: number; w: number; h: number }) => null;
TextBox.displayName = 'TextBox';

// Helper: build a minimal fake ReactElement with props injected directly,
// bypassing React.createElement (which strips __source in React 19).
function makeFakeElement(
  type: ReactElement['type'],
  props: Record<string, unknown>,
  key?: string,
): ReactElement {
  return {
    $$typeof: Symbol.for('react.element'),
    type,
    key: key ?? null,
    ref: null,
    props,
  } as unknown as ReactElement;
}

describe('getComponentName', () => {
  it('returns the HTML tag string for native elements', () => {
    const el = React.createElement('div', null);
    expect(getComponentName(el)).toBe('div');
  });

  it('returns displayName when set on a function component', () => {
    const el = React.createElement(TextBox, { x: 0, y: 0, w: 1, h: 1 });
    expect(getComponentName(el)).toBe('TextBox');
  });

  it('returns function name when displayName is absent', () => {
    function NamedComponent(_props: Record<string, unknown>): null {
      return null;
    }
    const el = React.createElement(NamedComponent, {});
    expect(getComponentName(el)).toBe('NamedComponent');
  });

  it('returns Anonymous when both displayName and name are absent', () => {
    // Construct a component object with no displayName and empty name to simulate
    // an anonymous function whose name cannot be read.
    const anonymousComponent = (() => null) as unknown as React.ComponentType;
    // Construct the element via makeFakeElement to bypass React internals.
    const el = makeFakeElement(
      Object.defineProperty(anonymousComponent, 'name', { value: '', writable: false }),
      {},
    );
    expect(getComponentName(el)).toBe('Anonymous');
  });
});

describe('getElementKey', () => {
  it('returns undefined when key is null', () => {
    const el = React.createElement('div', null);
    expect(getElementKey(el)).toBeUndefined();
  });

  it('strips the .$ prefix added by Children.toArray', () => {
    // React.createElement with key prop stores the key as-is
    const el = React.createElement('div', { key: '.$tb1' });
    expect(getElementKey(el)).toBe('tb1');
  });

  it('returns the key unchanged when it does not start with .$', () => {
    const el = React.createElement('div', { key: 'plain' });
    expect(getElementKey(el)).toBe('plain');
  });
});

describe('buildBreadcrumb', () => {
  it('populates componentName, key, and source when __source is present in props', () => {
    // React 19 strips __source when using React.createElement, so we use a
    // fake element that has __source directly in props to test the code path.
    const el = makeFakeElement(
      TextBox,
      {
        x: 0, y: 0, w: 1, h: 1,
        __source: { fileName: 'foo.tsx', lineNumber: 10, columnNumber: 4 },
      },
      '.$tb1',
    );
    const crumb = buildBreadcrumb(el);
    expect(crumb.componentName).toBe('TextBox');
    expect(crumb.key).toBe('tb1');
    expect(crumb.source?.fileName).toBe('foo.tsx');
    expect(crumb.source?.lineNumber).toBe(10);
    expect(crumb.source?.columnNumber).toBe(4);
  });

  it('leaves source undefined when __source is absent in props', () => {
    const el = React.createElement(TextBox, { x: 0, y: 0, w: 1, h: 1 });
    const crumb = buildBreadcrumb(el);
    expect(crumb.componentName).toBe('TextBox');
    expect(crumb.source).toBeUndefined();
  });

  it('leaves source undefined when __source has wrong shape', () => {
    const el = makeFakeElement(TextBox, {
      x: 0, y: 0, w: 1, h: 1,
      __source: { notAFileName: 'oops' },
    });
    const crumb = buildBreadcrumb(el);
    expect(crumb.source).toBeUndefined();
  });

  it('returns key stripped of .$ prefix', () => {
    const el = makeFakeElement('div', {}, '.$d1');
    const crumb = buildBreadcrumb(el);
    expect(crumb.key).toBe('d1');
  });

  it('returns key undefined when key is null', () => {
    const el = React.createElement('div', null);
    const crumb = buildBreadcrumb(el);
    expect(crumb.key).toBeUndefined();
  });
});

describe('formatBreadcrumbChain', () => {
  it('formats a chain with source locations', () => {
    const chain: DslBreadcrumb[] = [
      {
        componentName: 'Scene',
        key: 'bfm-hero',
        source: { fileName: '/scenes/scene_hero.tsx', lineNumber: 7, columnNumber: 2 },
      },
      {
        componentName: 'TextBox',
        key: 'bfm-hero-content',
        source: { fileName: '/scenes/scene_hero.tsx', lineNumber: 13, columnNumber: 6 },
      },
    ];
    expect(formatBreadcrumbChain(chain)).toBe(
      'Scene[bfm-hero] (/scenes/scene_hero.tsx:7) > TextBox[bfm-hero-content] (/scenes/scene_hero.tsx:13)',
    );
  });

  it('formats a chain without source locations (production simulation)', () => {
    const chain: DslBreadcrumb[] = [
      { componentName: 'Scene', key: 'bfm-hero' },
      { componentName: 'TextBox', key: 'bfm-hero-content' },
    ];
    const result = formatBreadcrumbChain(chain);
    expect(result).toBe('Scene[bfm-hero] > TextBox[bfm-hero-content]');
    expect(result).not.toContain('/scenes/');
    expect(result).not.toContain(':7');
  });

  it('formats a single entry with no key', () => {
    const chain: DslBreadcrumb[] = [
      { componentName: 'div' },
    ];
    expect(formatBreadcrumbChain(chain)).toBe('div');
  });

  it('returns an empty string for an empty chain', () => {
    expect(formatBreadcrumbChain([])).toBe('');
  });
});

describe('formatSourceLocation', () => {
  it('formats the location string when source is present', () => {
    const crumb: DslBreadcrumb = {
      componentName: 'Scene',
      source: { fileName: '/app/scene.tsx', lineNumber: 5, columnNumber: 2 },
    };
    expect(formatSourceLocation(crumb)).toBe(' at /app/scene.tsx:5');
  });

  it('returns empty string when source is absent', () => {
    const crumb: DslBreadcrumb = { componentName: 'Scene' };
    expect(formatSourceLocation(crumb)).toBe('');
  });
});
