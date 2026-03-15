import type {JSX} from 'react';
import {lazy, Suspense} from 'react';
import {Route, Routes} from 'react-router';

const ChartDemoPage = lazy(() => import('./chart/ChartDemoPage'));
const ArchitecturePage = lazy(() => import('./architecture/ArchitecturePage'));
const SidecarNotePage = lazy(() => import('./brewflow-sidecar/SidecarNotePage'));
const MemorySubsystemPage = lazy(() => import('./brewflow-memory/MemorySubsystemPage'));
const ComparisonPage = lazy(() => import('./brewflow-comparison/ComparisonPage'));
const MultiUserPage = lazy(() => import('./brewflow-multiuser/MultiUserPage'));
const SlidesDemoPage = lazy(() => import('./slides-demo/SlidesDemoPage'));
const WhiteboardArchPage = lazy(() => import('./whiteboard-arch/WhiteboardArchPage'));
const ThemeGalleryPage = lazy(() => import('./theme-gallery/ThemeGalleryPage'));
const ViewDemoPage = lazy(() => import('./views/ViewDemoPage'));
const InputShowcasePage = lazy(() => import('./input-showcase/InputShowcasePage'));
const CoreShowcasePage = lazy(() => import('./core-showcase/CoreShowcasePage'));
const MediaScreenDemoPage = lazy(() => import('./media-screen-demo/MediaScreenDemoPage'));
const ModelShowcasePage = lazy(() => import('./model-showcase/ModelShowcasePage'));
const CanvasRegionPage = lazy(() => import('./canvas-region/CanvasRegionPage'));

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
        <Route
          path="/"
          element={
            <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
              <h1>BrewSite Examples</h1>
              <ul>
                <li><a href="/examples/chart">Chart Demo</a></li>
                <li><a href="/examples/slides-demo">Slides Demo — @brewsite/slides</a></li>
                <li><a href="/examples/theme-gallery">Theme Family Gallery (all 12 variants)</a></li>
                <li><a href="/examples/views">View/ViewLayout Demo</a></li>
                <li><a href="/examples/input-showcase">Input Options Showcase</a></li>
                <li><a href="/examples/core-showcase">Core Showcase — @brewsite/core Features</a></li>
                <li><a href="/examples/media-screen-demo">MediaScreen Demo — @brewsite/screens</a></li>
                <li><a href="/examples/model-showcase">Model Showcase — @brewsite/model</a></li>
                <li><a href="/examples/canvas-region">Canvas Region — Embedded 3D Viewer</a></li>
              </ul>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
