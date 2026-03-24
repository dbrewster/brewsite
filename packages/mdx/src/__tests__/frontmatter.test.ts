// Tests for frontmatter extraction — pure function tests.

import { describe, it, expect } from 'vitest';
import { extractFrontmatterBlock, hasFrontmatter } from '../frontmatter';

describe('extractFrontmatterBlock', () => {
  it('extracts YAML frontmatter from source', () => {
    const source = `---
title: Hello
author: Team
---

# Content`;
    expect(extractFrontmatterBlock(source)).toBe('title: Hello\nauthor: Team');
  });

  it('returns null when no frontmatter is present', () => {
    expect(extractFrontmatterBlock('# Just a heading')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFrontmatterBlock('')).toBeNull();
  });

  it('handles frontmatter with empty body', () => {
    const source = `---
title: Empty
---`;
    expect(extractFrontmatterBlock(source)).toBe('title: Empty');
  });

  it('handles frontmatter with multi-line values', () => {
    const source = `---
title: Hello
tags:
  - security
  - architecture
---

# Content`;
    const result = extractFrontmatterBlock(source);
    expect(result).toContain('tags:');
    expect(result).toContain('  - security');
  });

  it('does not match frontmatter delimiters in the middle of content', () => {
    const source = `# Heading

Some text
---
not frontmatter
---`;
    expect(extractFrontmatterBlock(source)).toBeNull();
  });
});

describe('hasFrontmatter', () => {
  it('returns true when frontmatter is present', () => {
    const source = `---
title: Hello
---

# Content`;
    expect(hasFrontmatter(source)).toBe(true);
  });

  it('returns false when no frontmatter is present', () => {
    expect(hasFrontmatter('# Just a heading')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasFrontmatter('')).toBe(false);
  });
});
