#!/usr/bin/env node
// Builds the Orama search index from documentation markdown files.
// Reads docs/, chunks by ## heading, embeds each chunk, serializes to index/orama-index.json.
//
// Skips the expensive embedding step when docs and chunker haven't changed
// (checksummed via SHA-256 stored in index/.docs-hash).

import { create, insert, save } from '@orama/orama';
import { pipeline, env } from '@huggingface/transformers';
import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const DOCS_DIR = join(PKG_ROOT, 'docs');
const INDEX_DIR = join(PKG_ROOT, 'index');
const MODEL_DIR = join(PKG_ROOT, 'models', 'nomic-embed-text-v1.5');
const HASH_FILE = join(INDEX_DIR, '.docs-hash');
const INDEX_FILE = join(INDEX_DIR, 'orama-index.json');

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
  return results.sort();
}

// ─── Step 2: Compute content hash ────────────────────────────────────────────
// Hash all doc files + the chunker source so any content or chunking logic
// change invalidates the cache. File paths are included so renames/moves count.

function computeDocsHash(mdFiles) {
  const hash = createHash('sha256');

  // Include chunker source — chunking logic changes affect output
  const chunkerPath = join(PKG_ROOT, 'src', 'chunker.ts');
  if (existsSync(chunkerPath)) {
    hash.update('chunker:');
    hash.update(readFileSync(chunkerPath));
  }

  // Include every doc file (sorted for determinism)
  for (const file of mdFiles) {
    // Include relative path so renames invalidate
    hash.update(file.slice(DOCS_DIR.length));
    hash.update(readFileSync(file));
  }

  return hash.digest('hex');
}

// ─── Step 3: Chunk using compiled chunker ────────────────────────────────────

// Import the chunker from the esbuild output (build.mjs must run first)
const { chunkMarkdownFile } = await import('../dist/chunker.js');

// ─── Step 4: Build index ─────────────────────────────────────────────────────

async function main() {
  console.log('Building Orama index...');

  // Discover docs
  const mdFiles = findMarkdownFiles(DOCS_DIR);
  console.log(`Found ${mdFiles.length} markdown files.`);

  // Check if we can skip — hash matches and index exists
  const currentHash = computeDocsHash(mdFiles);
  if (existsSync(HASH_FILE) && existsSync(INDEX_FILE)) {
    const storedHash = readFileSync(HASH_FILE, 'utf-8').trim();
    if (storedHash === currentHash) {
      console.log('Docs unchanged (hash match) — skipping embedding.');
      return;
    }
  }

  // Chunk all docs
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
  const jsonStr = JSON.stringify(serialized);
  writeFileSync(INDEX_FILE, jsonStr);

  // Write hash so the next build can skip if docs haven't changed
  writeFileSync(HASH_FILE, currentHash);

  const sizeMB = (Buffer.byteLength(jsonStr) / (1024 * 1024)).toFixed(2);
  console.log(`Index written to ${INDEX_FILE} (${sizeMB} MB, ${allChunks.length} documents)`);
}

main().catch((err) => {
  console.error('Index build failed:', err);
  process.exit(1);
});
