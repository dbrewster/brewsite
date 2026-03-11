// Tests for the DIAGRAM_THEMES registry in themes/index.ts.

import { describe, it, expect } from 'vitest';
import { DIAGRAM_THEMES } from '../index';

describe('DIAGRAM_THEMES registry completeness', () => {
  it('DIAGRAM_THEMES contains exactly 6 keys', () => {
    expect(Object.keys(DIAGRAM_THEMES)).toHaveLength(6);
  });

  it('DIAGRAM_THEMES contains all canonical theme names', () => {
    expect(DIAGRAM_THEMES).toHaveProperty('darkGlass');
    expect(DIAGRAM_THEMES).toHaveProperty('midnight');
    expect(DIAGRAM_THEMES).toHaveProperty('neonCyber');
    expect(DIAGRAM_THEMES).toHaveProperty('enterprise');
    expect(DIAGRAM_THEMES).toHaveProperty('lightCanvas');
    expect(DIAGRAM_THEMES).toHaveProperty('lightMinimal');
  });

  it('DIAGRAM_THEMES.midnight is a valid DiagramTheme with expected node defaultColor', () => {
    expect(DIAGRAM_THEMES.midnight.node.defaultColor).toBe('#18140a');
  });

  it('DIAGRAM_THEMES.lightCanvas is a valid DiagramTheme with expected node defaultColor', () => {
    expect(DIAGRAM_THEMES.lightCanvas.node.defaultColor).toBe('#ffffff');
  });
});
