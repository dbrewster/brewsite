// React hook: fetch, convert, and compile a Lucid document page into a DiagramState.
//
// Handles the full async lifecycle:
//   1. Check compiled-state cache (localStorage)
//   2. If miss: fetch from proxy → convert → compile → write cache
//   3. Returns current state at every step for progressive rendering
//
// Cancels in-flight requests on unmount or when (documentId, pageIndex) changes.
// Errors are exposed (not thrown) so callers can render gracefully.

import { useState, useEffect, useRef } from 'react';
import type { DiagramState, DiagramTheme } from '../elements/diagram/types';
import { compileDiagram } from '../elements/diagram/compile';
import { darkGlassTheme } from '../elements/diagram/themes/darkGlass';
import { convertLucidPage } from './converter';
import { fetchLucidPage, LucidAuthError, LucidFetchError } from './client';
import {
  readCachedDiagramState,
  writeCachedDiagramState,
  evictCachedDocument,
} from './cache';

export type LucidDiagramStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'error:auth'
  | 'error:fetch'
  | 'error:other';

export interface UseLucidDiagramResult {
  /** The compiled DiagramState, or null while loading / on error */
  readonly diagramState: DiagramState | null;
  readonly status: LucidDiagramStatus;
  /** Human-readable error message. Only set when status starts with 'error:' */
  readonly errorMessage: string | null;
  /** Clears error state and re-attempts the load */
  readonly retry: () => void;
}

interface Options {
  /** Uniform scale for coordinate conversion. Default: 0.01 */
  scale?: number;
  /** Pivot for the compiled diagram. Default: 'top-left' */
  pivot?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Theme applied during compilation. Default: darkGlassTheme */
  theme?: DiagramTheme;
}

/**
 * Fetches and compiles a Lucid document page into a DiagramState.
 * Returns null while loading, the compiled state on success, and exposes
 * a typed status for error handling.
 *
 * @param documentId - Lucid document ID, or null to skip loading
 * @param pageIndex  - Zero-based page index within the document
 * @param opts       - Scale, pivot, and theme options
 */
export function useLucidDiagram(
  documentId: string | null,
  pageIndex: number,
  opts: Options = {},
): UseLucidDiagramResult {
  // scale defaults to 1 because the converter already divides Lucid pixel
  // coordinates by PIXEL_TO_UNIT (100), so positions are already in diagram
  // units (0–10 range for a typical 1000px diagram). Applying an additional
  // 0.01 factor would make everything 10,000× too small.
  const { scale = 1, pivot = 'top-left', theme = darkGlassTheme } = opts;

  const [diagramState, setDiagramState] = useState<DiagramState | null>(null);
  const [status, setStatus] = useState<LucidDiagramStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!documentId) {
      setDiagramState(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDiagramState(null);
    setStatus('loading');
    setErrorMessage(null);

    void (async () => {
      try {
        const { page, etag } = await fetchLucidPage(documentId, pageIndex, controller.signal);

        // Check compiled-state cache before running the compiler
        if (etag) {
          const cached = readCachedDiagramState(documentId, pageIndex, etag);
          if (cached) {
            setDiagramState(cached);
            setStatus('loaded');
            return;
          }
        }

        const diagramId = `lucid-${documentId}-p${pageIndex}`;
        const dsl = convertLucidPage(page, diagramId, { scale, pivot });
        const state = compileDiagram(dsl, theme);

        if (etag) {
          evictCachedDocument(documentId, pageIndex);
          writeCachedDiagramState(documentId, pageIndex, etag, state);
        }

        if (!controller.signal.aborted) {
          setDiagramState(state);
          setStatus('loaded');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        if (err instanceof LucidAuthError) {
          setStatus('error:auth');
          setErrorMessage('Not authenticated with Lucid.');
        } else if (err instanceof LucidFetchError) {
          setStatus('error:fetch');
          setErrorMessage(`Failed to load document (${err.status}): ${err.message}`);
        } else {
          setStatus('error:other');
          setErrorMessage((err as Error).message ?? 'Unknown error');
          console.error('[useLucidDiagram] Unexpected error:', err);
        }
      }
    })();

    return () => { controller.abort(); };
  // retryCount deliberately included so retry() re-runs the effect
  }, [documentId, pageIndex, scale, pivot, theme, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => setRetryCount((n) => n + 1);

  return { diagramState, status, errorMessage, retry };
}
