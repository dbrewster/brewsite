// Types for the Lucid document search API.
// These mirror the response schema of POST https://api.lucid.co/documents/search.
// No runtime imports. No React. No Three.js.

/**
 * A single document entry returned by the Lucid search API.
 * Field names match the Lucid REST API response exactly.
 */
export interface LucidDocumentSummary {
  /** UUID — used as the documentId in GET /documents/{id}/contents */
  readonly documentId: string;
  /** Human-readable title set by the author */
  readonly title: string;
  /** Lucid product: 'lucidchart' | 'lucidspark' | 'lucidscale' */
  readonly product: string;
  /** ISO 8601 creation timestamp */
  readonly created: string;
  /** ISO 8601 last-modification timestamp */
  readonly lastModified: string;
  /** Total number of pages in the document */
  readonly pageCount: number;
  /** True if the current user can edit the document */
  readonly canEdit: boolean;
  /** Direct URL to view the document in Lucid */
  readonly viewUrl: string;
  /** Direct URL to edit the document in Lucid */
  readonly editUrl: string;
  /** Document owner info */
  readonly owner?: {
    readonly id: string;
    readonly name: string;
    readonly type: string;
  };
}

/** Request body forwarded to POST https://api.lucid.co/documents/search */
export interface LucidSearchRequest {
  /** Full-text search keywords. If provided, results are ranked by relevance. */
  readonly keywords?: string;
  /** Filter to a specific product type */
  readonly product?: 'lucidchart' | 'lucidspark' | 'lucidscale' | 'all';
  /** Maximum results to return. Default: 20. Max: 200. */
  readonly pageSize?: number;
  /** Opaque pagination token from a previous response */
  readonly pageToken?: string;
}

/** Response shape from the search proxy endpoint */
export interface LucidSearchResponse {
  readonly documents: ReadonlyArray<LucidDocumentSummary>;
  /** Opaque token — present when more results are available */
  readonly nextPageToken: string | null;
}
