// Markdown document chunking for the search index.
// Used by both build-index.mjs (at build time) and tests.

import { readFileSync } from 'node:fs';
import { relative, basename } from 'node:path';
import type { DocChunk } from './types.js';

/**
 * Parse a markdown file into chunks split on ## headings.
 * Each chunk carries metadata: filePath, heading, title, topic.
 */
export function chunkMarkdownFile(filePath: string, docsRoot: string): DocChunk[] {
  const raw = readFileSync(filePath, 'utf-8');
  return chunkMarkdownContent(raw, relative(docsRoot, filePath));
}

/**
 * Chunk raw markdown content. Exposed for testing without file I/O.
 */
export function chunkMarkdownContent(raw: string, relPath: string): DocChunk[] {
  const topic = relPath.split('/')[0];

  // Extract front matter title if present
  let title = basename(relPath, '.md');
  const fmMatch = raw.match(/^---\n[\s\S]*?title:\s*["']?(.+?)["']?\s*\n[\s\S]*?---/);
  if (fmMatch) {
    title = fmMatch[1];
  }

  // Also check for a top-level # heading (overrides front matter)
  const h1Match = raw.match(/^#\s+(.+)$/m);
  if (h1Match) {
    title = h1Match[1];
  }

  // Split on ## headings
  const lines = raw.split('\n');
  const chunks: DocChunk[] = [];
  let currentHeading = '(introduction)';
  let currentLines: string[] = [];

  // Skip front matter
  let i = 0;
  if (lines[0] === '---') {
    i = 1;
    while (i < lines.length && lines[i] !== '---') i++;
    i++; // skip closing ---
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      // Save previous chunk if it has content
      const content = currentLines.join('\n').trim();
      if (content.length > 0) {
        chunks.push({
          id: `${relPath}#${currentHeading}`,
          content,
          meta: { filePath: relPath, heading: currentHeading, title, topic },
        });
      }
      currentHeading = h2Match[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last chunk
  const lastContent = currentLines.join('\n').trim();
  if (lastContent.length > 0) {
    chunks.push({
      id: `${relPath}#${currentHeading}`,
      content: lastContent,
      meta: { filePath: relPath, heading: currentHeading, title, topic },
    });
  }

  return chunks;
}
