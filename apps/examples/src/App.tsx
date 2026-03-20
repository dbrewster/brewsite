import type {JSX} from 'react';
import {lazy, Suspense} from 'react';
import {Link, Route, Routes} from 'react-router';
import {ExampleHeader, EXAMPLES} from './ExampleHeader';

const ChartDemoPage = lazy(() => import('./chart/ChartDemoPage'));
const SlidesDemoPage = lazy(() => import('./slides-demo/SlidesDemoPage'));
const ThemeGalleryPage = lazy(() => import('./theme-gallery/ThemeGalleryPage'));
const ViewDemoPage = lazy(() => import('./views/ViewDemoPage'));
const InputShowcasePage = lazy(() => import('./input-showcase/InputShowcasePage'));
const CoreShowcasePage = lazy(() => import('./core-showcase/CoreShowcasePage'));
const MediaScreenDemoPage = lazy(() => import('./media-screen-demo/MediaScreenDemoPage'));
const ModelShowcasePage = lazy(() => import('./model-showcase/ModelShowcasePage'));
const CanvasRegionPage = lazy(() => import('./canvas-region/CanvasRegionPage'));
const CarouselSelectionPage = lazy(() => import('./carousel-selection/CarouselSelectionPage'));

function Loading(): JSX.Element {
  return <div style={{ padding: '2rem' }}>Loading example...</div>;
}

export default function ExamplesApp(): JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/chart" element={<ChartDemoPage />} />
        <Route path="/slides-demo" element={<SlidesDemoPage />} />
        <Route path="/theme-gallery" element={<ThemeGalleryPage />} />
        <Route path="/views" element={<ViewDemoPage />} />
        <Route path="/input-showcase" element={<InputShowcasePage />} />
        <Route path="/core-showcase" element={<CoreShowcasePage />} />
        <Route path="/media-screen-demo" element={<MediaScreenDemoPage />} />
        <Route path="/model-showcase" element={<ModelShowcasePage />} />
        <Route path="/canvas-region" element={<CanvasRegionPage />} />
        <Route path="/carousel-selection" element={<CarouselSelectionPage />} />
        <Route
          path="/"
          element={
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              background: '#0a0a1a',
              color: '#e0e0e8',
              overflow: 'hidden',
            }}>
              <ExampleHeader />
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 2.5rem' }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>BrewSite Examples</h1>
                <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 32 }}>
                  Interactive demos of the BrewSite toolkit. Pick one from the menu above or the grid below.
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 12,
                  maxWidth: 960,
                }}>
                  {EXAMPLES.map((ex) => (
                    <Link
                      key={ex.path}
                      to={ex.path}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '16px 18px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{ex.label}</span>
                        {ex.badge && (
                          <span style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#8b95cf',
                            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            fontWeight: 500,
                          }}>
                            {ex.badge}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, opacity: 0.5, lineHeight: 1.4 }}>
                        {ex.description}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
