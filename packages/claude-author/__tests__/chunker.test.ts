// Tests for the markdown chunking logic.

import { describe, it, expect } from 'vitest';
import { chunkMarkdownContent } from '../src/chunker.js';

describe('chunkMarkdownContent', () => {
  it('chunks a markdown file with 3 ## sections into 3 chunks', () => {
    const md = [
      '## Section One',
      'Content of section one.',
      '',
      '## Section Two',
      'Content of section two.',
      '',
      '## Section Three',
      'Content of section three.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/my-doc.md');

    expect(chunks).toHaveLength(3);
    expect(chunks[0].meta.heading).toBe('Section One');
    expect(chunks[0].content).toBe('Content of section one.');
    expect(chunks[1].meta.heading).toBe('Section Two');
    expect(chunks[1].content).toBe('Content of section two.');
    expect(chunks[2].meta.heading).toBe('Section Three');
    expect(chunks[2].content).toBe('Content of section three.');
  });

  it('extracts front matter title field correctly', () => {
    const md = [
      '---',
      'title: "Input DSL"',
      'status: published',
      '---',
      '',
      '## WheelMap',
      'Some content about wheel map.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/input-dsl.md');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].meta.title).toBe('Input DSL');
  });

  it('falls back to # heading as title when no front matter', () => {
    const md = [
      '# Camera DSL',
      '',
      '## Overview',
      'Camera overview content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/camera.md');

    // The # heading line produces an introduction chunk, then the ## section
    expect(chunks).toHaveLength(2);
    expect(chunks[0].meta.heading).toBe('(introduction)');
    expect(chunks[0].meta.title).toBe('Camera DSL');
    expect(chunks[1].meta.heading).toBe('Overview');
    expect(chunks[1].meta.title).toBe('Camera DSL');
  });

  it('assigns correct topic from directory structure', () => {
    const md = [
      '## Nodes',
      'Node content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'diagram/nodes-edges.md');

    expect(chunks[0].meta.topic).toBe('diagram');
  });

  it('generates correct chunk IDs in filePath#heading format', () => {
    const md = [
      '## WheelMap',
      'Wheel content.',
      '',
      '## KeyMap',
      'Key content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/input-dsl.md');

    expect(chunks[0].id).toBe('core/input-dsl.md#WheelMap');
    expect(chunks[1].id).toBe('core/input-dsl.md#KeyMap');
  });

  it('handles file with no ## headings (single introduction chunk)', () => {
    const md = [
      '# Simple Doc',
      '',
      'This document has no second-level headings.',
      'It is all introduction content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'guides/simple.md');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].meta.heading).toBe('(introduction)');
    expect(chunks[0].content).toContain('This document has no second-level headings.');
  });

  it('handles file with front matter correctly (strips it from content)', () => {
    const md = [
      '---',
      'title: "Test Doc"',
      'status: draft',
      '---',
      '',
      '## First Section',
      'First content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/test.md');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('First content.');
    expect(chunks[0].content).not.toContain('---');
    expect(chunks[0].content).not.toContain('title:');
  });

  it('handles empty sections (skips them)', () => {
    const md = [
      '## Non-Empty',
      'Has content.',
      '',
      '## Empty',
      '',
      '## Also Non-Empty',
      'More content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/mixed.md');

    expect(chunks).toHaveLength(2);
    expect(chunks[0].meta.heading).toBe('Non-Empty');
    expect(chunks[1].meta.heading).toBe('Also Non-Empty');
  });

  it('uses basename as title fallback when no front matter or # heading', () => {
    const md = [
      '## Only Section',
      'Some content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'charts/bar-chart.md');

    expect(chunks[0].meta.title).toBe('bar-chart');
  });

  it('# heading overrides front matter title', () => {
    const md = [
      '---',
      'title: "Front Matter Title"',
      '---',
      '',
      '# Heading Title',
      '',
      '## Section',
      'Content.',
    ].join('\n');

    const chunks = chunkMarkdownContent(md, 'core/test.md');

    expect(chunks[0].meta.title).toBe('Heading Title');
  });
});
