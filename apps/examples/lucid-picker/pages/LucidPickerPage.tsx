// LucidPickerPage — browse, select, and preview a Lucid document in 3D.
//
// URL state: ?doc={documentId}&page={pageIndex}
// Persisting selections in the URL allows sharing/bookmarking a specific document view.
//
// Layout:
//   ┌──────────────────────────────────────────┐
//   │  Header: current selection + "Change" btn │
//   ├──────────────────────────────────────────┤
//   │                                           │
//   │   3D preview (ScenePlayer)  ← full area   │
//   │     or empty-state prompt                 │
//   │                                           │
//   └──────────────────────────────────────────┘
//   [LucidDocumentPicker modal overlay on demand]

import { useLayoutEffect, useState, useCallback, type JSX } from 'react';
import { useSearchParams } from 'react-router';
import { ScenePlayer } from '@brewsite/core';
import { LucidDocumentPicker, useLucidDiagram, darkGlassTheme } from '@brewsite/diagram';
import { LucidAuthGate } from '../components/LucidAuthGate';
import {
  buildPreviewScene,
  buildPreviewWidgetSetup,
} from '../previewSceneSetup';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LucidPickerPage(): JSX.Element {
  return (
    <LucidAuthGate>
      <PickerPageInner />
    </LucidAuthGate>
  );
}

// ─── Inner (authenticated) ────────────────────────────────────────────────────

function PickerPageInner(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);

  const documentId = searchParams.get('doc');
  const pageIndex = Math.max(0, Number(searchParams.get('page') ?? 0));

  // Lock scroll restoration
  useLayoutEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0 });
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // Load and compile the selected document
  const { diagramState, status, errorMessage, retry } = useLucidDiagram(
    documentId,
    pageIndex,
    { theme: darkGlassTheme, pivot: 'top-left' },
  );

  const handleSelect = useCallback((docId: string, page: number, title: string) => {
    setSearchParams({ doc: docId, page: String(page), title });
    setPickerOpen(false);
  }, [setSearchParams]);

  const hasSelection = !!documentId;

  return (
    <div style={css.root}>
      {/* ── Header bar ── */}
      <div style={css.header}>
        <div style={css.headerLeft}>
          <span style={css.logoMark}>◈</span>
          <div>
            <h1 style={css.title}>Lucid Document Viewer</h1>
            {hasSelection && (
              <p style={css.subtitle}>
                Document: <span style={css.docId}>{documentId}</span>
                {pageIndex > 0 && <span style={css.pageLabel}> · page {pageIndex + 1}</span>}
              </p>
            )}
          </div>
        </div>
        <div style={css.headerRight}>
          {hasSelection && (
            <a
              href={`https://lucid.app/documents/${documentId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={css.linkButton}
            >
              Open in Lucid ↗
            </a>
          )}
          {hasSelection && (
            <a
              href={`/api/lucid/${documentId}/download?title=${encodeURIComponent(searchParams.get('title') ?? documentId ?? '')}`}
              download
              style={css.linkButton}
            >
              ↓ Download .lucid
            </a>
          )}
          <button style={css.pickButton} onClick={() => setPickerOpen(true)}>
            {hasSelection ? '⟳ Change document' : '◈ Choose document'}
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={css.main}>
        {!hasSelection && (
          <EmptyState onPickerOpen={() => setPickerOpen(true)} />
        )}

        {hasSelection && status === 'loading' && (
          <LoadingState />
        )}

        {hasSelection && (status === 'error:auth' || status === 'error:fetch' || status === 'error:other') && (
          <ErrorState
            message={errorMessage ?? 'Unknown error'}
            isAuthError={status === 'error:auth'}
            onRetry={retry}
          />
        )}

        {hasSelection && status === 'loaded' && diagramState && (
          // Key forces ScenePlayer to fully remount when the document changes,
          // avoiding state bleed between different diagram compilations.
          <ScenePlayer
            key={`${documentId}:${pageIndex}`}
            sceneGroup={{
              id: 'lucid-preview',
              scenes: [buildPreviewScene(diagramState)],
            }}
            manifestUrl="/scene-manifest.json"
            widgetSetup={(manifest) => buildPreviewWidgetSetup(manifest, diagramState)}
            framesPerTick={80}
            pixelsPerScene={800}
            onError={(err) => console.error('[LucidPickerPage] ScenePlayer error:', err)}
            placeholder={<LoadingState />}
          />
        )}
      </div>

      {/* ── Picker modal ── */}
      {pickerOpen && (
        <LucidDocumentPicker
          onSelect={handleSelect}
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ onPickerOpen }: { onPickerOpen: () => void }): JSX.Element {
  return (
    <div style={css.emptyState}>
      <div style={css.emptyCard}>
        <span style={css.emptyIcon}>◈</span>
        <h2 style={css.emptyHeading}>No document selected</h2>
        <p style={css.emptyBody}>
          Browse your Lucid workspace to pick a diagram and visualize it here
          in 3D.
        </p>
        <button style={css.emptyButton} onClick={onPickerOpen}>
          Browse documents →
        </button>
      </div>

      {/* Subtle grid background */}
      <div style={css.gridBg} aria-hidden />
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <div style={css.stateCenter}>
      <div style={css.loadSpinner} />
      <p style={css.stateLabel}>Loading diagram…</p>
    </div>
  );
}

function ErrorState({
  message,
  isAuthError,
  onRetry,
}: {
  message: string;
  isAuthError: boolean;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div style={css.stateCenter}>
      <span style={css.errorIcon}>⚠</span>
      <p style={css.errorHeading}>
        {isAuthError ? 'Session expired' : 'Failed to load diagram'}
      </p>
      <p style={css.errorBody}>{message}</p>
      {isAuthError ? (
        <button
          style={css.retryButton}
          onClick={() => { window.location.href = '/auth/login'; }}
        >
          Re-authenticate with Lucid
        </button>
      ) : (
        <button style={css.retryButton} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    background: '#08101e', color: '#e8eeff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px',
    background: '#0a1428',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    zIndex: 10, flexShrink: 0,
    gap: '16px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoMark: { fontSize: '24px', color: '#7faeff', userSelect: 'none' },
  title: {
    margin: 0, fontSize: '16px', fontWeight: 600,
    color: '#e8eeff', letterSpacing: '-0.02em',
  },
  subtitle: { margin: '2px 0 0', fontSize: '11px', color: '#506080' },
  docId: { color: '#7faeff', fontFamily: 'monospace', fontSize: '11px' },
  pageLabel: { color: '#8ba4d4' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  linkButton: {
    padding: '7px 14px', fontSize: '12px',
    background: 'none', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '7px', color: '#8ba4d4',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  pickButton: {
    padding: '7px 16px', fontSize: '13px', fontWeight: 500,
    background: '#1a2a4a', border: '1px solid rgba(42,79,160,0.5)',
    borderRadius: '7px', color: '#7faeff',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },

  // Main content
  main: {
    flex: 1, position: 'relative', overflow: 'hidden',
  },

  // Empty state
  emptyState: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyCard: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px', padding: '48px 40px', maxWidth: '400px',
    background: 'rgba(15, 26, 46, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
  },
  emptyIcon: {
    fontSize: '48px', color: 'rgba(127,174,255,0.3)',
    userSelect: 'none', lineHeight: 1,
  },
  emptyHeading: {
    margin: 0, fontSize: '20px', fontWeight: 600,
    color: '#e8eeff', textAlign: 'center', letterSpacing: '-0.02em',
  },
  emptyBody: {
    margin: 0, fontSize: '14px', color: '#8ba4d4',
    textAlign: 'center', lineHeight: 1.6,
  },
  emptyButton: {
    padding: '11px 28px', fontSize: '14px', fontWeight: 600,
    background: '#2a4fa0', border: '1px solid #3560c0',
    borderRadius: '9px', color: '#e8eeff', cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '-0.01em',
  },
  gridBg: {
    position: 'absolute', inset: 0, zIndex: 0,
    backgroundImage: `
      linear-gradient(rgba(42,79,160,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(42,79,160,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 100%)',
  },

  // Loading / error shared center layout
  stateCenter: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '12px',
  },
  loadSpinner: {
    width: '32px', height: '32px',
    border: '2px solid rgba(255,255,255,0.06)',
    borderTopColor: '#7faeff',
    borderRadius: '50%',
    animation: 'lucid-page-spin 0.7s linear infinite',
  },
  stateLabel: { margin: 0, color: '#8ba4d4', fontSize: '14px' },
  errorIcon: { fontSize: '36px', color: '#f06060', userSelect: 'none' },
  errorHeading: { margin: 0, fontSize: '17px', fontWeight: 600, color: '#e8eeff' },
  errorBody: {
    margin: 0, fontSize: '13px', color: '#8ba4d4',
    maxWidth: '320px', textAlign: 'center',
  },
  retryButton: {
    marginTop: '4px', padding: '9px 22px',
    background: '#1a2a4a', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', color: '#e8eeff',
    fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
  },
};

// Inject spinner keyframes
if (typeof document !== 'undefined') {
  const id = 'lucid-page-keyframes';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = '@keyframes lucid-page-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(el);
  }
}
