#!/usr/bin/env node
// CLI command: npx @brewsite/claude-author init
// Writes Claude Code integration files into the current project.

import { mkdirSync, existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve template directory relative to the built dist/bin/init.js
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

/**
 * Run the init command against the given project root.
 * Exported for testing.
 */
export function run(projectRoot: string): void {
  console.log('Setting up BrewSite documentation for Claude Code...\n');

  // 1. Write .claude/mcp-servers/brewsite-docs.js
  const mcpServersDir = join(projectRoot, '.claude', 'mcp-servers');
  const mcpServerFile = join(mcpServersDir, 'brewsite-docs.js');
  mkdirSync(mcpServersDir, { recursive: true });

  if (!existsSync(mcpServerFile)) {
    copyFileSync(join(TEMPLATES_DIR, 'brewsite-docs.js'), mcpServerFile);
    console.log('  Created .claude/mcp-servers/brewsite-docs.js');
  } else {
    console.log('  Skipped .claude/mcp-servers/brewsite-docs.js (already exists)');
  }

  // 2. Write .claude/agents/brewsite-scene-author.md
  const agentsDir = join(projectRoot, '.claude', 'agents');
  const agentFile = join(agentsDir, 'brewsite-scene-author.md');
  mkdirSync(agentsDir, { recursive: true });

  if (!existsSync(agentFile)) {
    copyFileSync(join(TEMPLATES_DIR, 'brewsite-scene-author.md'), agentFile);
    console.log('  Created .claude/agents/brewsite-scene-author.md');
  } else {
    console.log('  Skipped .claude/agents/brewsite-scene-author.md (already exists)');
  }

  // 3. Write .mcp.json at project root (merge if it already exists)
  const mcpJsonFile = join(projectRoot, '.mcp.json');
  const mcpTemplatePath = join(TEMPLATES_DIR, 'mcp.json');

  if (!existsSync(mcpJsonFile)) {
    copyFileSync(mcpTemplatePath, mcpJsonFile);
    console.log('  Created .mcp.json');
  } else {
    try {
      const existing = JSON.parse(readFileSync(mcpJsonFile, 'utf-8'));
      const template = JSON.parse(readFileSync(mcpTemplatePath, 'utf-8'));
      existing.mcpServers = existing.mcpServers ?? {};
      Object.assign(existing.mcpServers, template.mcpServers);
      writeFileSync(mcpJsonFile, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
      console.log('  Updated .mcp.json (merged brewsite-docs server)');
    } catch {
      console.log('  Warning: could not parse existing .mcp.json — skipping merge');
    }
  }

  // 4. Usage and version control guidance
  console.log('\n  How it works:');
  console.log('    The .mcp.json file tells Claude Code to start the BrewSite docs MCP server.');
  console.log('    The server provides brewsite_search, brewsite_get_doc, and brewsite_list_topics');
  console.log('    tools for AI-assisted scene authoring.');
  console.log('');
  console.log('  Files to commit to version control:');
  console.log('    .mcp.json');
  console.log('    .claude/agents/brewsite-scene-author.md');
  console.log('    .claude/mcp-servers/brewsite-docs.js');
  console.log('\n  These files have no secrets and enable Claude Code for all team members.\n');

  console.log('Done! Restart Claude Code to activate the BrewSite documentation server.');
}

// Entry point
const projectRoot = process.cwd();
run(projectRoot);
