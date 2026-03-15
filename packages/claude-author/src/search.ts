// Orama index loading and hybrid search implementation.

import { create, load, search as oramaSearch, getByID, count } from '@orama/orama';
import type { RawData } from '@orama/orama';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { embedQuery } from './embedder.js';
import type { SearchResult, TopicArea } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** The Orama schema definition, matching the index build schema. */
const ORAMA_SCHEMA = {
  id: 'string' as const,
  content: 'string' as const,
  embedding: 'vector[768]' as const,
  filePath: 'string' as const,
  heading: 'string' as const,
  title: 'string' as const,
  topic: 'string' as const,
};

/** The Orama database instance, loaded once at startup. */
let db: ReturnType<typeof create<typeof ORAMA_SCHEMA>> | null = null;

/** Pre-computed topic counts, populated by loadIndex(). */
const topicCounts = new Map<string, number>();

/** Topic metadata for the listing tool. */
interface TopicInfo {
  topic: string;
  count: number;
  description: string;
}

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  core: 'Scene DSL, camera, lighting, background, floor, environment, input controllers, HUD overlays',
  diagram: 'Diagram nodes, edges, groups, canvas, image panels, screens',
  model: 'GLTF model loading, animations, labels, bone annotations',
  charts: 'Bar, line, area, scatter, pie, heatmap charts with 3D rendering',
  screens: 'Media screen element for embedding video/image content',
  guides: 'Transitions, embedding modes, NVS spatial model, advanced patterns, common gotchas',
};

/**
 * Load the pre-built Orama index from disk into memory.
 * Must be called once at server startup before any search operations.
 * Also pre-computes topic counts for listTopics().
 */
export async function loadIndex(): Promise<void> {
  // When running from dist/server.js, the index is at ../index/orama-index.json
  const indexPath = join(__dirname, '..', 'index', 'orama-index.json');
  const raw = readFileSync(indexPath, 'utf-8');
  const data: RawData = JSON.parse(raw);

  // Create an empty Orama instance with the matching schema, then load data into it
  db = create({ schema: ORAMA_SCHEMA });
  load(db, data);

  // Pre-compute topic counts
  topicCounts.clear();
  for (const topic of Object.keys(TOPIC_DESCRIPTIONS)) {
    const results = await oramaSearch(db, {
      term: '',
      where: { topic },
      limit: 1,
    });
    topicCounts.set(topic, results.count);
  }
}

/**
 * Load index from raw data (for testing without file I/O).
 */
export async function loadIndexFromData(data: RawData): Promise<void> {
  db = create({ schema: ORAMA_SCHEMA });
  load(db, data);

  topicCounts.clear();
  for (const topic of Object.keys(TOPIC_DESCRIPTIONS)) {
    const results = await oramaSearch(db, {
      term: '',
      where: { topic },
      limit: 1,
    });
    topicCounts.set(topic, results.count);
  }
}

/**
 * Perform hybrid search (BM25 + vector) on the documentation index.
 */
export async function searchDocs(
  query: string,
  options: { topic?: TopicArea; limit?: number } = {},
): Promise<SearchResult[]> {
  if (!db) throw new Error('Index not loaded. Call loadIndex() first.');

  const limit = options.limit ?? 5;
  const queryEmbedding = await embedQuery(query);

  // Build filter if topic is specified
  const where = options.topic ? { topic: options.topic } : undefined;

  const results = await oramaSearch(db, {
    term: query,
    vector: {
      value: queryEmbedding,
      property: 'embedding',
    },
    mode: 'hybrid',
    limit,
    ...(where ? { where } : {}),
  });

  return results.hits.map((hit) => {
    const doc = hit.document;
    return {
      id: doc.id as string,
      content: doc.content as string,
      score: hit.score,
      meta: {
        filePath: doc.filePath as string,
        heading: doc.heading as string,
        title: doc.title as string,
        topic: doc.topic as string,
      },
    };
  });
}

/**
 * Retrieve a specific document chunk by its ID.
 * Returns null if not found.
 */
export function getDocById(id: string): SearchResult | null {
  if (!db) throw new Error('Index not loaded. Call loadIndex() first.');

  const doc = getByID(db, id);
  if (!doc) return null;

  return {
    id: doc.id as string,
    content: doc.content as string,
    score: 1.0,
    meta: {
      filePath: doc.filePath as string,
      heading: doc.heading as string,
      title: doc.title as string,
      topic: doc.topic as string,
    },
  };
}

/**
 * List all topic areas with section counts.
 * Reads from the pre-computed topic count map built at loadIndex() time.
 */
export function listTopics(): TopicInfo[] {
  if (!db) throw new Error('Index not loaded. Call loadIndex() first.');

  return Object.keys(TOPIC_DESCRIPTIONS).map((topic) => ({
    topic,
    count: topicCounts.get(topic) ?? 0,
    description: TOPIC_DESCRIPTIONS[topic] ?? '',
  }));
}
