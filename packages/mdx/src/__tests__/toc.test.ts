// Tests for slugify, remarkToc, and nestHeadings — pure function tests.

import { describe, it, expect } from 'vitest';
import { slugify, remarkToc, nestHeadings } from '../toc';
import type { FlatHeading } from '../types';

// ─── slugify ─────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar baz')).toBe('foo-bar-baz');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('foo -- bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Step 1: Setup')).toBe('step-1-setup');
  });

  it('trims whitespace before processing', () => {
    expect(slugify('  spaced out  ')).toBe('spaced-out');
  });
});

// ─── nestHeadings ────────────────────────────────────────────────────────────

describe('nestHeadings', () => {
  it('returns empty array for empty input', () => {
    expect(nestHeadings([])).toEqual([]);
  });

  it('excludes h1 headings', () => {
    const flat: FlatHeading[] = [
      { depth: 1, text: 'Title', id: 'title' },
      { depth: 2, text: 'Section', id: 'section' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Section');
  });

  it('creates top-level entries for h2 headings', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'First', id: 'first' },
      { depth: 2, text: 'Second', id: 'second' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('First');
    expect(result[1].text).toBe('Second');
  });

  it('nests h3 under preceding h2', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'Parent', id: 'parent' },
      { depth: 3, text: 'Child', id: 'child' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].text).toBe('Child');
  });

  it('nests h4 under preceding h3', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'Section', id: 'section' },
      { depth: 3, text: 'Subsection', id: 'subsection' },
      { depth: 4, text: 'Detail', id: 'detail' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].text).toBe('Detail');
  });

  it('handles sibling h3s under the same h2', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'Parent', id: 'parent' },
      { depth: 3, text: 'Child A', id: 'child-a' },
      { depth: 3, text: 'Child B', id: 'child-b' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].text).toBe('Child A');
    expect(result[0].children[1].text).toBe('Child B');
  });

  it('handles depth jump back to h2 after h3', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'First', id: 'first' },
      { depth: 3, text: 'Sub', id: 'sub' },
      { depth: 2, text: 'Second', id: 'second' },
    ];
    const result = nestHeadings(flat);
    expect(result).toHaveLength(2);
    expect(result[0].children).toHaveLength(1);
    expect(result[1].children).toHaveLength(0);
  });

  it('preserves entry structure with id and children fields', () => {
    const flat: FlatHeading[] = [
      { depth: 2, text: 'Test Heading', id: 'test-heading' },
    ];
    const result = nestHeadings(flat);
    expect(result[0]).toEqual({
      depth: 2,
      text: 'Test Heading',
      id: 'test-heading',
      children: [],
    });
  });

  it('handles all h1 headings (returns empty)', () => {
    const flat: FlatHeading[] = [
      { depth: 1, text: 'Title', id: 'title' },
      { depth: 1, text: 'Another', id: 'another' },
    ];
    expect(nestHeadings(flat)).toEqual([]);
  });
});

// ─── remarkToc ───────────────────────────────────────────────────────────────

describe('remarkToc', () => {
  it('collects heading nodes from an mdast tree', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Hello' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'body' }] },
        { type: 'heading', depth: 3, children: [{ type: 'text', value: 'World' }] },
      ],
    };
    const file = { data: {} as Record<string, unknown> };
    const plugin = remarkToc();
    plugin(tree, file);

    expect(file.data.toc).toEqual([
      { depth: 2, text: 'Hello', id: 'hello' },
      { depth: 3, text: 'World', id: 'world' },
    ]);
  });

  it('handles empty tree', () => {
    const tree = { type: 'root', children: [] };
    const file = { data: {} as Record<string, unknown> };
    const plugin = remarkToc();
    plugin(tree, file);

    expect(file.data.toc).toEqual([]);
  });

  it('concatenates text from multiple inline children', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 2,
          children: [
            { type: 'text', value: 'Hello ' },
            { type: 'inlineCode', value: 'World' },
          ],
        },
      ],
    };
    const file = { data: {} as Record<string, unknown> };
    const plugin = remarkToc();
    plugin(tree, file);

    expect(file.data.toc).toEqual([
      { depth: 2, text: 'Hello World', id: 'hello-world' },
    ]);
  });
});
