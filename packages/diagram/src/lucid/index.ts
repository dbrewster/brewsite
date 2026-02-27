// Public re-exports for the @brewsite/diagram lucid integration module.

export type {
  LucidDocumentJSON, LucidPageJSON, LucidItemJSON,
  LucidBoundingBox, LucidConvertOptions,
} from './types';

export type { LucidDocumentSummary, LucidSearchRequest, LucidSearchResponse } from './searchTypes';

export { convertLucidPage, selectLucidPage } from './converter';

export {
  readCachedDiagramState, writeCachedDiagramState,
  evictCachedDocument, buildCacheKey,
} from './cache';

export {
  fetchLucidPage, searchLucidDocuments, checkLucidAuthStatus,
  LucidAuthError, LucidFetchError,
} from './client';

export { LucidDocumentPicker } from './picker';
export type { LucidDocumentPickerProps } from './picker';

export { useLucidDiagram } from './useLucidDiagram';
export type { UseLucidDiagramResult, LucidDiagramStatus } from './useLucidDiagram';
