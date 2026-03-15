#!/usr/bin/env node
// CLI command: npx @brewsite/claude-author init
// Writes Claude Code integration files into the current project.

import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
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

  // 3. Usage and version control guidance
  console.log('\n  How it works:');
  console.log('    The BrewSite docs MCP server is scoped to the brewsite-scene-author agent.');
  console.log('    It connects automatically when the agent is spawned as a subagent from a');
  console.log('    parent conversation (e.g., via the Agent tool or team workflow).');
  console.log('');
  console.log('    NOTE: The MCP server does NOT connect when using `claude --agent`');
  console.log('    to launch the agent directly. Agent-scoped MCP servers only activate');
  console.log('    when running as a subagent. If you need the docs server available in');
  console.log('    a direct agent session, add the server to your project .mcp.json:');
  console.log('');
  console.log('      {');
  console.log('        "mcpServers": {');
  console.log('          "brewsite-docs": {');
  console.log('            "command": "node",');
  console.log('            "args": ["./.claude/mcp-servers/brewsite-docs.js"]');
  console.log('          }');
  console.log('        }');
  console.log('      }');
  console.log('');
  console.log('  Files to commit to version control:');
  console.log('    .claude/agents/brewsite-scene-author.md');
  console.log('    .claude/mcp-servers/brewsite-docs.js');
  console.log('\n  These files have no secrets and enable Claude Code for all team members.\n');

  console.log('Done! Restart Claude Code to activate the BrewSite documentation server.');
}

// Entry point
const projectRoot = process.cwd();
run(projectRoot);
