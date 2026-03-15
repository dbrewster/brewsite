#!/usr/bin/env node
// MCP server for BrewSite documentation search.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadIndex, searchDocs, getDocById, listTopics } from './search.js';
import { initEmbedder } from './embedder.js';

const server = new McpServer({
  name: 'brewsite-docs',
  version: '0.1.0',
});

// --- Tool: brewsite_search ---
server.tool(
  'brewsite_search',
  'Search BrewSite documentation by natural language query. Uses hybrid BM25 + vector search for best results. Returns ranked documentation chunks with source provenance.',
  {
    query: z.string().describe('Natural language search query, e.g. "how do camera transitions work"'),
    topic: z.enum(['core', 'diagram', 'model', 'charts', 'screens', 'guides']).optional()
      .describe('Optional topic filter to narrow results to a specific package area'),
    limit: z.number().int().min(1).max(20).default(5)
      .describe('Maximum number of results to return (default: 5)'),
  },
  async ({ query, topic, limit }) => {
    const results = await searchDocs(query, { topic, limit });
    const formatted = results.map((r, i) =>
      `### Result ${i + 1} (score: ${r.score.toFixed(3)})\n` +
      `**Source:** \`${r.meta.filePath}\` → \`## ${r.meta.heading}\`\n` +
      `**Document:** ${r.meta.title}\n\n` +
      r.content
    ).join('\n\n---\n\n');

    return {
      content: [{ type: 'text' as const, text: formatted || 'No results found.' }],
    };
  },
);

// --- Tool: brewsite_get_doc ---
server.tool(
  'brewsite_get_doc',
  'Retrieve a specific documentation section by its chunk ID. Use this after brewsite_search to get the full content of a known section.',
  {
    id: z.string().describe('Document chunk ID in format "filePath#heading", e.g. "core/input-dsl.md#WheelMap"'),
  },
  async ({ id }) => {
    const doc = getDocById(id);
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: `No document found with ID: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [{
        type: 'text' as const,
        text: `**Source:** \`${doc.meta.filePath}\` → \`## ${doc.meta.heading}\`\n` +
              `**Document:** ${doc.meta.title}\n\n` +
              doc.content,
      }],
    };
  },
);

// --- Tool: brewsite_list_topics ---
server.tool(
  'brewsite_list_topics',
  'List all available documentation topic areas and the number of sections in each. Use this for discovery before searching.',
  {},
  async () => {
    const topics = listTopics();
    const formatted = topics.map(t =>
      `- **${t.topic}** — ${t.count} section${t.count === 1 ? '' : 's'}: ${t.description}`
    ).join('\n');
    return {
      content: [{ type: 'text' as const, text: formatted }],
    };
  },
);

// --- Startup ---
async function main(): Promise<void> {
  await loadIndex();
  await initEmbedder();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('brewsite-docs MCP server failed to start:', err);
  process.exit(1);
});
