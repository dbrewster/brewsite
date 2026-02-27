// LucidDocumentPicker — browse, search, and select a Lucid document.
//
// Renders as a modal overlay. The presenter searches their Lucid workspace,
// filters by product type, picks a document, optionally selects a page, and
// confirms. The onSelect callback receives (documentId, pageIndex).
//
// Search is server-side via POST /api/lucid/search. The query is debounced
// 350ms so the API is not hit on every keystroke.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { searchLucidDocuments, LucidAuthError } from '../client';
import type { LucidDocumentSummary, LucidSearchRequest } from '../searchTypes';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface LucidDocumentPickerProps {
  /** Called when the presenter confirms a selection. */
  onSelect: (documentId: string, pageIndex: number, title: string) => void;
  /** Called when the presenter dismisses the picker without selecting. */
  onDismiss: () => void;
  /** Initial search query. Default: '' (shows most recent documents). */
  initialQuery?: string;
  /** Initial product filter. Default: 'all'. */
  initialProduct?: 'all' | 'lucidchart' | 'lucidspark';
}

// ─── Internal types ──────────────────────────────────────────────────────────

type ProductFilter = 'all' | 'lucidchart' | 'lucidspark';

interface PickerState {
  query: string;
  product: ProductFilter;
  documents: LucidDocumentSummary[];
  nextPageToken: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  selectedDocumentId: string | null;
  selectedPageIndex: number;
  expandedDocumentId: string | null; // document with expanded page selector
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LucidDocumentPicker({
  onSelect,
  onDismiss,
  initialQuery = '',
  initialProduct = 'all',
}: LucidDocumentPickerProps): JSX.Element {
  const [state, setState] = useState<PickerState>({
    query: initialQuery,
    product: initialProduct,
    documents: [],
    nextPageToken: null,
    isLoading: true,
    isLoadingMore: false,
    error: null,
    selectedDocumentId: null,
    selectedPageIndex: 0,
    expandedDocumentId: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Search execution ────────────────────────────────────────────────────────

  const runSearch = useCallback(async (req: LucidSearchRequest, append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({
      ...s,
      isLoading: !append,
      isLoadingMore: append,
      error: null,
    }));

    try {
      const result = await searchLucidDocuments(req, controller.signal);
      setState((s) => ({
        ...s,
        documents: append ? [...s.documents, ...result.documents] : [...result.documents],
        nextPageToken: result.nextPageToken,
        isLoading: false,
        isLoadingMore: false,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof LucidAuthError
        ? 'Session expired — please reconnect your Lucid account.'
        : `Search failed: ${(err as Error).message}`;
      setState((s) => ({ ...s, isLoading: false, isLoadingMore: false, error: message }));
    }
  }, []);

  // Initial load + re-search on filter change (with debounce for query)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch({
        keywords: state.query || undefined,
        product: state.product === 'all' ? undefined : state.product,
        pageSize: 24,
      });
    }, state.query === '' ? 0 : 350); // no debounce delay on initial/filter change
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [state.query, state.product, runSearch]);

  // Focus search input on mount
  useEffect(() => {
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Cleanup abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleQueryChange = (q: string) =>
    setState((s) => ({ ...s, query: q, selectedDocumentId: null }));

  const handleProductChange = (p: ProductFilter) =>
    setState((s) => ({
      ...s,
      product: p,
      documents: [],
      nextPageToken: null,
      selectedDocumentId: null,
    }));

  const handleLoadMore = () => {
    if (!state.nextPageToken || state.isLoadingMore) return;
    void runSearch({
      keywords: state.query || undefined,
      product: state.product === 'all' ? undefined : state.product,
      pageSize: 24,
      pageToken: state.nextPageToken,
    }, true);
  };

  const handleSelectDocument = (doc: LucidDocumentSummary) => {
    setState((s) => ({
      ...s,
      selectedDocumentId: doc.documentId,
      selectedPageIndex: 0,
      // Auto-expand page selector for multi-page docs
      expandedDocumentId: doc.pageCount > 1 ? doc.documentId : null,
    }));
  };

  const handleToggleExpand = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState((s) => ({
      ...s,
      expandedDocumentId: s.expandedDocumentId === docId ? null : docId,
    }));
  };

  const handlePageSelect = (pageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setState((s) => ({ ...s, selectedPageIndex: pageIndex }));
  };

  const handleConfirm = () => {
    if (!state.selectedDocumentId) return;
    const title = state.documents.find((d) => d.documentId === state.selectedDocumentId)?.title ?? '';
    onSelect(state.selectedDocumentId, state.selectedPageIndex, title);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onDismiss();
    if (e.key === 'Enter' && state.selectedDocumentId) handleConfirm();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedDoc = state.documents.find((d) => d.documentId === state.selectedDocumentId);

  return (
    <div style={css.backdrop} onClick={onDismiss} onKeyDown={handleKeyDown} role="dialog" aria-modal>
      <div style={css.panel} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={css.header}>
          <div style={css.headerLeft}>
            <span style={css.headerIcon}>◈</span>
            <div>
              <h2 style={css.heading}>Select a Lucid Document</h2>
              <p style={css.subheading}>Browse and search your workspace</p>
            </div>
          </div>
          <button style={css.closeButton} onClick={onDismiss} aria-label="Close">✕</button>
        </div>

        {/* ── Search + filter bar ── */}
        <div style={css.toolbar}>
          <div style={css.searchWrap}>
            <span style={css.searchIcon}>⌕</span>
            <input
              ref={searchInputRef}
              style={css.searchInput}
              type="text"
              placeholder="Search by title or keyword…"
              value={state.query}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="Search documents"
            />
            {state.query && (
              <button
                style={css.clearButton}
                onClick={() => handleQueryChange('')}
                aria-label="Clear search"
              >✕</button>
            )}
          </div>
          <div style={css.filterTabs} role="tablist">
            {(['all', 'lucidchart', 'lucidspark'] as ProductFilter[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={state.product === p}
                style={{ ...css.filterTab, ...(state.product === p ? css.filterTabActive : {}) }}
                onClick={() => handleProductChange(p)}
              >
                {PRODUCT_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Document grid ── */}
        <div style={css.resultsArea}>
          {state.isLoading && (
            <div style={css.centered}>
              <span style={css.spinner} />
              <p style={css.loadingText}>Loading documents…</p>
            </div>
          )}

          {!state.isLoading && state.error && (
            <div style={css.centered}>
              <p style={css.errorText}>{state.error}</p>
            </div>
          )}

          {!state.isLoading && !state.error && state.documents.length === 0 && (
            <div style={css.centered}>
              <p style={css.emptyIcon}>◈</p>
              <p style={css.emptyText}>
                {state.query
                  ? `No documents found for "${state.query}"`
                  : 'No documents found in your workspace'}
              </p>
            </div>
          )}

          {!state.isLoading && !state.error && state.documents.length > 0 && (
            <div style={css.grid}>
              {state.documents.map((doc) => {
                const isSelected = doc.documentId === state.selectedDocumentId;
                const isExpanded = doc.documentId === state.expandedDocumentId;
                return (
                  <div
                    key={doc.documentId}
                    style={{
                      ...css.card,
                      ...(isSelected ? css.cardSelected : {}),
                    }}
                    onClick={() => handleSelectDocument(doc)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectDocument(doc); }}
                  >
                    {/* Card header row */}
                    <div style={css.cardHeader}>
                      <span style={{ ...css.productBadge, ...productBadgeColor(doc.product) }}>
                        {PRODUCT_LABELS[doc.product as ProductFilter] ?? doc.product}
                      </span>
                      {isSelected && <span style={css.checkmark}>✓</span>}
                    </div>

                    {/* Document title */}
                    <p style={css.cardTitle}>{doc.title || '(Untitled)'}</p>

                    {/* Metadata row */}
                    <div style={css.cardMeta}>
                      <span style={css.metaItem}>
                        {formatDate(doc.lastModified)}
                      </span>
                      <span style={css.metaDot}>·</span>
                      <span style={css.metaItem}>
                        {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                      {!doc.canEdit && (
                        <>
                          <span style={css.metaDot}>·</span>
                          <span style={{ ...css.metaItem, color: TOKEN.textTertiary }}>read-only</span>
                        </>
                      )}
                    </div>

                    {/* Page selector — only for multi-page docs when selected + expanded */}
                    {doc.pageCount > 1 && isSelected && (
                      <div style={css.pageSection}>
                        <button
                          style={css.pageToggle}
                          onClick={(e) => handleToggleExpand(doc.documentId, e)}
                        >
                          {isExpanded ? '▲' : '▼'} Page {state.selectedPageIndex + 1} of {doc.pageCount}
                        </button>
                        {isExpanded && (
                          <div style={css.pageGrid}>
                            {Array.from({ length: doc.pageCount }, (_, i) => (
                              <button
                                key={i}
                                style={{
                                  ...css.pageChip,
                                  ...(state.selectedPageIndex === i ? css.pageChipActive : {}),
                                }}
                                onClick={(e) => handlePageSelect(i, e)}
                              >
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {state.nextPageToken && !state.isLoading && (
            <div style={css.loadMoreWrap}>
              <button
                style={css.loadMoreButton}
                onClick={handleLoadMore}
                disabled={state.isLoadingMore}
              >
                {state.isLoadingMore
                  ? <><span style={css.spinnerSmall} /> Loading…</>
                  : 'Load more documents'}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer / confirm strip ── */}
        <div style={css.footer}>
          <div style={css.footerLeft}>
            {selectedDoc ? (
              <span style={css.selectedHint}>
                <span style={css.selectedHintLabel}>Selected: </span>
                {selectedDoc.title || '(Untitled)'}
                {selectedDoc.pageCount > 1 && (
                  <span style={css.selectedHintPage}> · page {state.selectedPageIndex + 1}</span>
                )}
              </span>
            ) : (
              <span style={css.selectPrompt}>Click a document to select it</span>
            )}
          </div>
          <div style={css.footerActions}>
            <button style={css.cancelButton} onClick={onDismiss}>Cancel</button>
            <button
              style={{
                ...css.confirmButton,
                ...(!state.selectedDocumentId ? css.confirmButtonDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={!state.selectedDocumentId}
            >
              Use this document →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRODUCT_LABELS: Record<string, string> = {
  all: 'All',
  lucidchart: 'Lucidchart',
  lucidspark: 'Lucidspark',
  lucidscale: 'Lucidscale',
};

function productBadgeColor(product: string): React.CSSProperties {
  switch (product) {
    case 'lucidchart': return { background: 'rgba(42, 79, 160, 0.35)', color: '#7faeff' };
    case 'lucidspark': return { background: 'rgba(83, 236, 104, 0.15)', color: '#53ec68' };
    case 'lucidscale': return { background: 'rgba(160, 106, 32, 0.3)', color: '#f0a050' };
    default:           return { background: 'rgba(255,255,255,0.08)', color: TOKEN.textSecondary };
  }
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const TOKEN = {
  bg:             '#08101e',
  surface:        '#0f1a2e',
  surfaceRaised:  '#141f33',
  surfaceActive:  '#1a2a4a',
  border:         'rgba(255,255,255,0.08)',
  borderActive:   'rgba(42, 79, 160, 0.7)',
  accent:         '#2a4fa0',
  accentHover:    '#3560c0',
  accentText:     '#7faeff',
  textPrimary:    '#e8eeff',
  textSecondary:  '#8ba4d4',
  textTertiary:   '#506080',
  success:        '#53ec68',
  error:          '#f06060',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const css: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(4, 8, 18, 0.85)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  panel: {
    background: TOKEN.surface,
    border: `1px solid ${TOKEN.border}`,
    borderRadius: '12px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
    width: '100%', maxWidth: '860px',
    maxHeight: 'min(88vh, 820px)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${TOKEN.border}`,
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  headerIcon: {
    fontSize: '28px', color: TOKEN.accentText,
    lineHeight: 1, userSelect: 'none',
  },
  heading: {
    margin: 0, fontSize: '17px', fontWeight: 600,
    color: TOKEN.textPrimary, letterSpacing: '-0.01em',
  },
  subheading: {
    margin: '2px 0 0', fontSize: '12px', color: TOKEN.textSecondary,
  },
  closeButton: {
    background: 'none', border: 'none',
    color: TOKEN.textTertiary, fontSize: '16px',
    cursor: 'pointer', padding: '6px', borderRadius: '6px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },

  // Toolbar
  toolbar: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '14px 24px 12px',
    borderBottom: `1px solid ${TOKEN.border}`,
    flexShrink: 0,
  },
  searchWrap: {
    position: 'relative', display: 'flex', alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute', left: '12px',
    fontSize: '18px', color: TOKEN.textTertiary,
    pointerEvents: 'none', userSelect: 'none',
    transform: 'scaleX(-1)',
  },
  searchInput: {
    width: '100%', padding: '9px 36px 9px 38px',
    background: TOKEN.surfaceRaised, border: `1px solid ${TOKEN.border}`,
    borderRadius: '8px', color: TOKEN.textPrimary,
    fontSize: '14px', outline: 'none',
    boxSizing: 'border-box',
  },
  clearButton: {
    position: 'absolute', right: '10px',
    background: 'none', border: 'none',
    color: TOKEN.textTertiary, fontSize: '13px',
    cursor: 'pointer', padding: '4px',
    lineHeight: 1,
  },
  filterTabs: {
    display: 'flex', gap: '4px',
  },
  filterTab: {
    padding: '5px 14px', borderRadius: '6px',
    background: 'transparent', border: `1px solid transparent`,
    color: TOKEN.textSecondary, fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  filterTabActive: {
    background: 'rgba(42, 79, 160, 0.25)',
    border: `1px solid rgba(42, 79, 160, 0.5)`,
    color: TOKEN.accentText,
  },

  // Results area
  resultsArea: {
    flex: 1, overflowY: 'auto', padding: '16px 24px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  centered: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '48px 0', gap: '10px',
  },
  spinner: {
    display: 'inline-block',
    width: '24px', height: '24px',
    border: `2px solid ${TOKEN.border}`,
    borderTopColor: TOKEN.accentText,
    borderRadius: '50%',
    animation: 'lucid-spin 0.7s linear infinite',
  },
  spinnerSmall: {
    display: 'inline-block',
    width: '13px', height: '13px',
    border: `2px solid rgba(255,255,255,0.15)`,
    borderTopColor: TOKEN.textPrimary,
    borderRadius: '50%',
    animation: 'lucid-spin 0.7s linear infinite',
    marginRight: '7px',
    verticalAlign: 'middle',
  },
  loadingText: { margin: 0, color: TOKEN.textSecondary, fontSize: '13px' },
  errorText: {
    margin: 0, color: TOKEN.error, fontSize: '13px',
    textAlign: 'center', maxWidth: '320px',
  },
  emptyIcon: {
    margin: 0, fontSize: '32px', color: TOKEN.textTertiary, userSelect: 'none',
  },
  emptyText: { margin: 0, color: TOKEN.textSecondary, fontSize: '14px', textAlign: 'center' },

  // Document grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '10px',
  },
  card: {
    background: TOKEN.surfaceRaised,
    border: `1px solid ${TOKEN.border}`,
    borderRadius: '8px', padding: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    display: 'flex', flexDirection: 'column', gap: '6px',
    outline: 'none',
  },
  cardSelected: {
    background: TOKEN.surfaceActive,
    border: `1px solid ${TOKEN.borderActive}`,
    boxShadow: `0 0 0 3px rgba(42, 79, 160, 0.18), inset 0 0 0 1px rgba(42,79,160,0.15)`,
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  productBadge: {
    display: 'inline-block', padding: '2px 8px',
    borderRadius: '4px', fontSize: '10px', fontWeight: 600,
    letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  },
  checkmark: {
    color: TOKEN.accentText, fontSize: '15px', fontWeight: 700, lineHeight: 1,
  },
  cardTitle: {
    margin: 0, fontSize: '13px', fontWeight: 500,
    color: TOKEN.textPrimary, lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  cardMeta: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '4px',
    marginTop: '2px',
  },
  metaItem: {
    fontSize: '11px', color: TOKEN.textSecondary,
  },
  metaDot: {
    fontSize: '11px', color: TOKEN.textTertiary,
  },

  // Page selector
  pageSection: {
    marginTop: '8px', paddingTop: '8px',
    borderTop: `1px solid ${TOKEN.border}`,
  },
  pageToggle: {
    background: 'none', border: 'none',
    color: TOKEN.textSecondary, fontSize: '11px',
    cursor: 'pointer', padding: '2px 0',
    fontFamily: 'inherit',
  },
  pageGrid: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '5px',
    marginTop: '8px',
  },
  pageChip: {
    width: '28px', height: '24px',
    background: TOKEN.surfaceRaised,
    border: `1px solid ${TOKEN.border}`,
    borderRadius: '5px', color: TOKEN.textSecondary,
    fontSize: '11px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.12s',
    fontFamily: 'inherit',
  },
  pageChipActive: {
    background: TOKEN.accent,
    border: `1px solid ${TOKEN.accentHover}`,
    color: TOKEN.textPrimary,
  },

  // Load more
  loadMoreWrap: {
    display: 'flex', justifyContent: 'center', paddingTop: '8px',
  },
  loadMoreButton: {
    padding: '8px 24px',
    background: TOKEN.surfaceRaised,
    border: `1px solid ${TOKEN.border}`,
    borderRadius: '8px', color: TOKEN.textSecondary,
    fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, color 0.15s',
  },

  // Footer
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px',
    borderTop: `1px solid ${TOKEN.border}`,
    background: TOKEN.bg,
    flexShrink: 0,
    gap: '12px',
  },
  footerLeft: { flex: 1, minWidth: 0 },
  selectedHint: {
    fontSize: '13px', color: TOKEN.textSecondary,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    display: 'block',
  },
  selectedHintLabel: { color: TOKEN.textTertiary },
  selectedHintPage: { color: TOKEN.accentText },
  selectPrompt: { fontSize: '13px', color: TOKEN.textTertiary },
  footerActions: { display: 'flex', gap: '10px', flexShrink: 0 },
  cancelButton: {
    padding: '8px 18px',
    background: 'none', border: `1px solid ${TOKEN.border}`,
    borderRadius: '8px', color: TOKEN.textSecondary,
    fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
  },
  confirmButton: {
    padding: '8px 20px',
    background: TOKEN.accent,
    border: `1px solid ${TOKEN.accentHover}`,
    borderRadius: '8px', color: TOKEN.textPrimary,
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    letterSpacing: '-0.01em', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  confirmButtonDisabled: {
    background: TOKEN.surfaceRaised,
    border: `1px solid ${TOKEN.border}`,
    color: TOKEN.textTertiary,
    cursor: 'not-allowed',
  },
};

// Inject the keyframe animation for the spinner once
if (typeof document !== 'undefined') {
  const styleId = 'lucid-picker-keyframes';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes lucid-spin {
        to { transform: rotate(360deg); }
      }
      [style*="lucid-picker"] input:focus {
        border-color: rgba(42,79,160,0.6) !important;
        box-shadow: 0 0 0 3px rgba(42,79,160,0.15);
      }
    `;
    document.head.appendChild(el);
  }
}
