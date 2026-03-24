// Tests for the default component map builder.

import { describe, it, expect } from 'vitest';
import { createDefaultComponents } from '../defaultComponents';

describe('createDefaultComponents', () => {
  it('returns an object with heading components', () => {
    const components = createDefaultComponents();
    expect(components.h1).toBeDefined();
    expect(components.h2).toBeDefined();
    expect(components.h3).toBeDefined();
    expect(components.h4).toBeDefined();
    expect(components.h5).toBeDefined();
    expect(components.h6).toBeDefined();
  });

  it('returns table wrapper component', () => {
    const components = createDefaultComponents();
    expect(components.table).toBeDefined();
  });

  it('returns smart link component', () => {
    const components = createDefaultComponents();
    expect(components.a).toBeDefined();
  });

  it('returns pre component for code blocks', () => {
    const components = createDefaultComponents();
    expect(components.pre).toBeDefined();
  });

  it('returns blockquote component for callouts', () => {
    const components = createDefaultComponents();
    expect(components.blockquote).toBeDefined();
  });

  it('returns SceneEmbed component', () => {
    const components = createDefaultComponents();
    expect(components.SceneEmbed).toBeDefined();
  });

  it('returns Scene component', () => {
    const components = createDefaultComponents();
    expect(components.Scene).toBeDefined();
  });

  it('returns Diagram DSL components', () => {
    const components = createDefaultComponents();
    expect(components.Diagram).toBeDefined();
    expect(components.DiagramNode).toBeDefined();
    expect(components.DiagramEdge).toBeDefined();
    expect(components.DiagramGroup).toBeDefined();
    expect(components.FlowLayout).toBeDefined();
  });

  it('accepts plugins and theme parameters without error', () => {
    const components = createDefaultComponents(
      [],
      { family: 'darkGlass', polarity: 'dark' },
    );
    expect(components.SceneEmbed).toBeDefined();
  });
});
