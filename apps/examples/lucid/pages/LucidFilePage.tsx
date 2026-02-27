// LucidFilePage — drag-and-drop any .lucid file and render it as a 3D diagram.
//
// Pipeline (fully browser-side, no server required):
//   .lucid file → fflate unzip → document.json → selectLucidPage
//   → convertLucidPage → compileDiagram → ScenePlayer
//
// Both Lucid export formats are supported:
//   - Legacy format: shapes have bounding-box positions → 'manual' layout
//   - Modern format: shapes have class fields, no positions → 'hierarchical' layout

import {
  useState, useRef, useCallback, useLayoutEffect,
  type JSX, type DragEvent, type ChangeEvent,
} from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { ScenePlayer } from '@brewsite/core';
import {
  compileDiagram, darkGlassTheme,
  selectLucidPage, convertLucidPage,
} from '@brewsite/diagram';
import type { DiagramState } from '@brewsite/diagram';
import {
  buildPreviewScene,
  buildPreviewWidgetSetup,
} from '../../lucid-picker/previewSceneSetup';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadedDoc {
  title: string;
  pageCount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LucidFilePage(): JSX.Element {
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [diagramState, setDiagramState] = useState<DiagramState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock scroll restoration while rendering
  useLayoutEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0 });
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // ── File processing ─────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.lucid') && file.type !== 'application/zip') {
      setError('Please drop a .lucid file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target!.result as ArrayBuffer);
        const unzipped = unzipSync(buffer);

        const docEntry = Object.keys(unzipped).find((k) => k.endsWith('document.json'));
        if (!docEntry) throw new Error('No document.json found inside the .lucid file.');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = JSON.parse(strFromU8(unzipped[docEntry])) as any;
        const pages = raw.pages ?? raw.document?.pages ?? [];

        setDoc({ title: raw.title ?? file.name.replace('.lucid', ''), pageCount: pages.length, raw });
        setPageIndex(0);
        setError(null);
        compilePage(raw, 0);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compilePage = (raw: any, index: number) => {
    const page = selectLucidPage(raw, index);
    if (!page) { setError(`Page ${index} not found.`); return; }

    const dsl = convertLucidPage(page, `lucid-file-p${index}`);
    const state = compileDiagram(dsl, darkGlassTheme);
    setDiagramState(state);
  };

  const handlePageChange = (index: number) => {
    if (!doc) return;
    setPageIndex(index);
    compilePage(doc.raw, index);
  };

  // ── Drag and drop ───────────────────────────────────────────────────────────

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={css.root}>

      {/* ── Header ── */}
      <div style={css.header}>
        <span style={css.logoMark}>◈</span>
        <div style={css.headerText}>
          <h1 style={css.title}>
            {doc ? doc.title : 'Lucid File Viewer'}
          </h1>
          {doc && (
            <span style={css.subtitle}>
              {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>
        <div style={css.headerActions}>
          {/* Page selector */}
          {doc && doc.pageCount > 1 && (
            <div style={css.pageTabs}>
              {Array.from({ length: doc.pageCount }, (_, i) => (
                <button
                  key={i}
                  style={{ ...css.pageTab, ...(pageIndex === i ? css.pageTabActive : {}) }}
                  onClick={() => handlePageChange(i)}
                >
                  Page {i + 1}
                </button>
              ))}
            </div>
          )}
          {/* Load different file */}
          <button style={css.loadButton} onClick={() => inputRef.current?.click()}>
            {doc ? '↺ Load another' : '↑ Open .lucid file'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".lucid"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={css.main}>

        {/* Drop zone — shown when no file is loaded */}
        {!doc && (
          <div
            style={{ ...css.dropZone, ...(isDragOver ? css.dropZoneActive : {}) }}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop a .lucid file here"
            onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
          >
            <span style={css.dropIcon}>◈</span>
            <p style={css.dropHeading}>Drop a .lucid file here</p>
            <p style={css.dropSub}>or click to browse</p>
            {error && <p style={css.dropError}>{error}</p>}
            <div style={css.gridBg} aria-hidden />
          </div>
        )}

        {/* Error after a file was loaded */}
        {doc && error && (
          <div style={css.errorBanner}>⚠ {error}</div>
        )}

        {/* 3D diagram preview */}
        {diagramState && (
          <ScenePlayer
            key={`${doc?.title ?? 'doc'}:${pageIndex}`}
            sceneGroup={{
              id: 'lucid-file-preview',
              scenes: [buildPreviewScene(diagramState)],
            }}
            manifestUrl="/scene-manifest.json"
            widgetSetup={(manifest) => buildPreviewWidgetSetup(manifest, diagramState)}
            framesPerTick={80}
            pixelsPerScene={800}
            onError={(err) => setError(err.message)}
            placeholder={
              <div style={css.loading}>
                <span style={css.spinner} />
                <p style={css.loadingText}>Rendering diagram…</p>
              </div>
            }
          />
        )}
      </div>
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
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 24px',
    background: '#0a1428',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  logoMark: { fontSize: '22px', color: '#7faeff', userSelect: 'none' },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    margin: 0, fontSize: '16px', fontWeight: 600,
    color: '#e8eeff', letterSpacing: '-0.02em',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  subtitle: { fontSize: '11px', color: '#506080' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  pageTabs: { display: 'flex', gap: '4px' },
  pageTab: {
    padding: '5px 12px', fontSize: '12px',
    background: 'none', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', color: '#8ba4d4', cursor: 'pointer', fontFamily: 'inherit',
  },
  pageTabActive: {
    background: 'rgba(42,79,160,0.3)', border: '1px solid rgba(42,79,160,0.6)',
    color: '#7faeff',
  },
  loadButton: {
    padding: '7px 16px', fontSize: '13px',
    background: '#1a2a4a', border: '1px solid rgba(42,79,160,0.5)',
    borderRadius: '7px', color: '#7faeff', cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { flex: 1, position: 'relative', overflow: 'hidden' },
  dropZone: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '12px', cursor: 'pointer',
    border: '2px dashed rgba(42,79,160,0.3)',
    margin: '40px', borderRadius: '16px',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropZoneActive: {
    borderColor: 'rgba(42,79,160,0.8)',
    background: 'rgba(42,79,160,0.06)',
  },
  dropIcon: { fontSize: '56px', color: 'rgba(127,174,255,0.25)', userSelect: 'none' },
  dropHeading: { margin: 0, fontSize: '20px', fontWeight: 600, color: '#e8eeff', letterSpacing: '-0.02em' },
  dropSub: { margin: 0, fontSize: '13px', color: '#506080' },
  dropError: { margin: 0, fontSize: '13px', color: '#f06060' },
  gridBg: {
    position: 'absolute', inset: 0, zIndex: -1, borderRadius: '14px',
    backgroundImage: `
      linear-gradient(rgba(42,79,160,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(42,79,160,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 30%, transparent 100%)',
  },
  errorBanner: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(80,0,0,0.8)', color: '#ffaaaa',
    padding: '8px 20px', borderRadius: '8px', fontSize: '13px', zIndex: 10,
  },
  loading: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '12px',
  },
  spinner: {
    display: 'inline-block', width: '28px', height: '28px',
    border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#7faeff',
    borderRadius: '50%', animation: 'lucid-file-spin 0.7s linear infinite',
  },
  loadingText: { margin: 0, color: '#8ba4d4', fontSize: '13px' },
};

if (typeof document !== 'undefined') {
  const id = 'lucid-file-keyframes';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = '@keyframes lucid-file-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(el);
  }
}
