#!/usr/bin/env node
// Builds the Orama search index from documentation markdown files.
// Reads docs/, chunks by ## heading, embeds each chunk, serializes to index/orama-index.json.

import { create, insert, save } from '@orama/orama';
import { pipeline, env } from '@huggingface/transformers';
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const DOCS_DIR = join(PKG_ROOT, 'docs');
const INDEX_DIR = join(PKG_ROOT, 'index');
const MODEL_DIR = join(PKG_ROOT, 'models', 'nomic-embed-text-v1.5');

// ─── Step 1: Discover all markdown files ─────────────────────────────────────

function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Step 2: Chunk using compiled chunker ────────────────────────────────────

// Import the chunker from the esbuild output (build.mjs must run first)
const { chunkMarkdownFile } = await import('../dist/chunker.js');

// ─── Step 3: Build index ─────────────────────────────────────────────────────

async function main() {
  console.log('Building Orama index...');

  // Discover and chunk all docs
  const mdFiles = findMarkdownFiles(DOCS_DIR);
  console.log(`Found ${mdFiles.length} markdown files.`);

  const allChunks = [];
  for (const file of mdFiles) {
    allChunks.push(...chunkMarkdownFile(file, DOCS_DIR));
  }
  console.log(`Produced ${allChunks.length} chunks.`);

  // Initialize embedding model
  console.log('Loading embedding model...');
  env.localModelPath = MODEL_DIR;
  env.allowRemoteModels = false;

  const embedder = await pipeline('feature-extraction', MODEL_DIR, {
    dtype: 'q4',
    device: 'cpu',
  });

  // Embed all chunks with search_document: prefix
  console.log('Embedding chunks...');
  const embeddings = [];
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const prefixed = `search_document: ${chunk.content}`;
    const output = await embedder(prefixed, { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(output.data));

    if ((i + 1) % 10 === 0 || i === allChunks.length - 1) {
      console.log(`  Embedded ${i + 1}/${allChunks.length}`);
    }
  }

  // Create Orama database
  console.log('Creating Orama index...');
  const db = create({
    schema: {
      id: 'string',
      content: 'string',
      embedding: 'vector[768]',
      filePath: 'string',
      heading: 'string',
      title: 'string',
      topic: 'string',
    },
  });

  // Insert all documents
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    insert(db, {
      id: chunk.id,
      content: chunk.content,
      embedding: embeddings[i],
      filePath: chunk.meta.filePath,
      heading: chunk.meta.heading,
      title: chunk.meta.title,
      topic: chunk.meta.topic,
    });
  }

  // Serialize to JSON
  mkdirSync(INDEX_DIR, { recursive: true });
  const serialized = save(db);
  const outputPath = join(INDEX_DIR, 'orama-index.json');
  const jsonStr = JSON.stringify(serialized);
  writeFileSync(outputPath, jsonStr);

  const sizeMB = (Buffer.byteLength(jsonStr) / (1024 * 1024)).toFixed(2);
  console.log(`Index written to ${outputPath} (${sizeMB} MB, ${allChunks.length} documents)`);
}

main().catch((err) => {
  console.error('Index build failed:', err);
  process.exit(1);
});
