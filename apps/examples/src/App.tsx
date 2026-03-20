import './styles/index.css';
import type {JSX} from 'react';
import {lazy, Suspense} from 'react';
import {Link, Route, Routes} from 'react-router';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import {ExampleHeader, EXAMPLES} from './ExampleHeader';
import { useThemeCss } from './hooks/useThemeCss';

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
  return <div className="ex-loading">Loading example...</div>;
}

function LandingPage(): JSX.Element {
  const family = (localStorage.getItem('themeFamily') as ThemeFamily) ?? 'darkGlass';
  const polarity = (localStorage.getItem('themePolarity') as ThemePolarity) ?? 'dark';
  useThemeCss(family, polarity);

  return (
    <div className="ex-page">
      <ExampleHeader />
      <div className="ex-scroll-content">
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>BrewSite Examples</h1>
        <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 32 }}>
          Interactive demos of the BrewSite toolkit. Pick one from the menu above or the grid below.
        </p>
        <div className="ex-card-grid">
          {EXAMPLES.map((ex) => (
            <Link
              key={ex.path}
              to={ex.path}
              className="ex-card"
            >
              <div className="ex-card__title">
                <span className="ex-card__name">{ex.label}</span>
                {ex.badge && (
                  <span className="ex-badge">
                    {ex.badge}
                  </span>
                )}
              </div>
              <span className="ex-card__desc">
                {ex.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
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
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </Suspense>
  );
}
