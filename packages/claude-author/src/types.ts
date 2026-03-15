// Shared type definitions for the @brewsite/claude-author package.

/** Metadata stored alongside each documentation chunk in the Orama index. */
export interface DocChunkMeta {
  /** Relative path from docs/, e.g. "core/input-dsl.md" */
  filePath: string;
  /** The exact ## section heading text, e.g. "WheelMap" */
  heading: string;
  /** The top-level # document title, e.g. "Input DSL" */
  title: string;
  /** Topic area derived from directory, e.g. "core", "diagram", "charts" */
  topic: string;
}

/** A single documentation chunk ready for indexing. */
export interface DocChunk {
  /** Unique chunk identifier: "{filePath}#{heading}" */
  id: string;
  /** The raw markdown text content of the chunk (without task prefix). */
  content: string;
  /** Metadata for provenance tracking. */
  meta: DocChunkMeta;
}

/** The Orama document schema shape (mirrors what is stored in the index). */
export interface OramaDocSchema {
  /** Unique chunk identifier. */
  id: string;
  /** Full text content for BM25 search. */
  content: string;
  /** Pre-computed embedding vector for vector search. */
  embedding: number[];
  /** Relative file path. */
  filePath: string;
  /** Section heading. */
  heading: string;
  /** Document title. */
  title: string;
  /** Topic area. */
  topic: string;
}

/** Result returned from a search query. */
export interface SearchResult {
  /** Chunk ID. */
  id: string;
  /** Matched content. */
  content: string;
  /** Relevance score (0-1, higher is better). */
  score: number;
  /** Source metadata. */
  meta: DocChunkMeta;
}

/** Available topic areas for listing. */
export type TopicArea = 'core' | 'diagram' | 'model' | 'charts' | 'screens' | 'guides';

/** MCP tool input schemas (used by the MCP server tool registration). */
export interface SearchDocsInput {
  /** Natural language search query. */
  query: string;
  /** Optional topic filter. */
  topic?: TopicArea;
  /** Maximum results to return. Default: 5. */
  limit?: number;
}

/** Input for retrieving a specific document by ID. */
export interface GetDocInput {
  /** Document chunk ID (format: "{filePath}#{heading}"). */
  id: string;
}

/** Input for listing all topic areas (no parameters). */
export interface ListTopicsInput {
  // No parameters — lists all available topic areas.
}

/** Configuration for the init command. */
export interface InitConfig {
  /** Absolute path to the target project root. */
  projectRoot: string;
}
