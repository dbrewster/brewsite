// Tests for the init CLI file writing and merging logic.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../src/bin/init.js';

describe('init CLI', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'brewsite-init-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates .claude/mcp-servers/brewsite-docs.js when none exists', () => {
    run(tempDir);

    const filePath = join(tempDir, '.claude', 'mcp-servers', 'brewsite-docs.js');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("import('@brewsite/claude-author/server')");
  });

  it('creates .claude/agents/brewsite-scene-author.md when none exists', () => {
    run(tempDir);

    const filePath = join(tempDir, '.claude', 'agents', 'brewsite-scene-author.md');
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('skips files that already exist (idempotency)', () => {
    // Create the files first
    const mcpServersDir = join(tempDir, '.claude', 'mcp-servers');
    mkdirSync(mcpServersDir, { recursive: true });
    writeFileSync(join(mcpServersDir, 'brewsite-docs.js'), 'existing content');

    const agentsDir = join(tempDir, '.claude', 'agents');
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, 'brewsite-scene-author.md'), 'existing agent');

    run(tempDir);

    // Should not overwrite existing files
    expect(readFileSync(join(mcpServersDir, 'brewsite-docs.js'), 'utf-8')).toBe('existing content');
    expect(readFileSync(join(agentsDir, 'brewsite-scene-author.md'), 'utf-8')).toBe('existing agent');
  });

  it('does not create .mcp.json', () => {
    run(tempDir);

    const mcpJsonPath = join(tempDir, '.mcp.json');
    expect(existsSync(mcpJsonPath)).toBe(false);
  });

  it('agent template contains mcpServers in frontmatter', () => {
    run(tempDir);

    const filePath = join(tempDir, '.claude', 'agents', 'brewsite-scene-author.md');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('mcpServers:');
    expect(content).toContain('brewsite-docs:');
  });
});
