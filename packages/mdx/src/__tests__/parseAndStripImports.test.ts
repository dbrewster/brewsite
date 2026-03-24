// Tests for parseAndStripImports and resolveImports — the import parsing pipeline.

import { describe, it, expect } from 'vitest';
import { parseAndStripImports } from '../useMdxCompile';

describe('parseAndStripImports', () => {
  it('parses a single named import', () => {
    const source = `import { Camera } from '@brewsite/core';\n\n# Hello`;
    const { imports, cleanSource } = parseAndStripImports(source);

    expect(imports).toEqual([
      { names: ['Camera'], from: '@brewsite/core' },
    ]);
    expect(cleanSource).toBe('\n# Hello');
  });

  it('parses multiple named imports from one line', () => {
    const source = `import { SceneEmbed, Scene, Camera } from '@brewsite/core';`;
    const { imports } = parseAndStripImports(source);

    expect(imports).toEqual([
      { names: ['SceneEmbed', 'Scene', 'Camera'], from: '@brewsite/core' },
    ]);
  });

  it('parses imports from multiple modules', () => {
    const source = [
      `import { SceneEmbed } from '@brewsite/core';`,
      `import { Diagram, DiagramNode } from '@brewsite/diagram';`,
      '',
      '# Content',
    ].join('\n');

    const { imports, cleanSource } = parseAndStripImports(source);

    expect(imports).toHaveLength(2);
    expect(imports[0]).toEqual({ names: ['SceneEmbed'], from: '@brewsite/core' });
    expect(imports[1]).toEqual({ names: ['Diagram', 'DiagramNode'], from: '@brewsite/diagram' });
    expect(cleanSource).toBe('\n# Content');
  });

  it('strips import lines from the clean source', () => {
    const source = [
      `import { Camera } from '@brewsite/core';`,
      '',
      '# Title',
      '',
      'Some content.',
    ].join('\n');

    const { cleanSource } = parseAndStripImports(source);

    expect(cleanSource).not.toContain('import');
    expect(cleanSource).toContain('# Title');
    expect(cleanSource).toContain('Some content.');
  });

  it('preserves export lines (local constants for MDX)', () => {
    const source = [
      `import { Camera } from '@brewsite/core';`,
      `export const nodeSize = ["60%", "10%"];`,
      '',
      '# Title',
    ].join('\n');

    const { cleanSource } = parseAndStripImports(source);

    expect(cleanSource).toContain('export const nodeSize');
    expect(cleanSource).not.toContain('import');
    expect(cleanSource).toContain('# Title');
  });

  it('handles double-quoted specifiers', () => {
    const source = `import { Camera } from "@brewsite/core";`;
    const { imports } = parseAndStripImports(source);

    expect(imports[0]!.from).toBe('@brewsite/core');
  });

  it('handles imports without semicolons', () => {
    const source = `import { Camera } from '@brewsite/core'`;
    const { imports } = parseAndStripImports(source);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.names).toEqual(['Camera']);
  });

  it('handles imports with extra whitespace', () => {
    const source = `import {  Camera ,  Scene  } from '@brewsite/core';`;
    const { imports } = parseAndStripImports(source);

    expect(imports[0]!.names).toEqual(['Camera', 'Scene']);
  });

  it('returns empty imports for content with no imports', () => {
    const source = '# Just markdown\n\nSome content.';
    const { imports, cleanSource } = parseAndStripImports(source);

    expect(imports).toEqual([]);
    expect(cleanSource).toBe(source);
  });

  it('strips bare side-effect imports', () => {
    const source = [
      `import 'some-polyfill';`,
      '',
      '# Title',
    ].join('\n');

    const { imports, cleanSource } = parseAndStripImports(source);

    // Bare imports are stripped but not parsed (no names to extract)
    expect(imports).toEqual([]);
    expect(cleanSource).not.toContain('import');
  });

  it('preserves non-import content exactly', () => {
    const source = [
      `import { Foo } from 'bar';`,
      '',
      '# Title',
      '',
      '<SceneEmbed height={380}>',
      '  <Scene id="test" />',
      '</SceneEmbed>',
      '',
      '| Column A | Column B |',
      '|----------|----------|',
      '| value    | value    |',
    ].join('\n');

    const { cleanSource } = parseAndStripImports(source);

    expect(cleanSource).toContain('<SceneEmbed height={380}>');
    expect(cleanSource).toContain('<Scene id="test" />');
    expect(cleanSource).toContain('| Column A | Column B |');
  });
});
