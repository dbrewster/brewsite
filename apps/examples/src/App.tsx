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

function Loading(): JSX.Element {
  return <div style={{ padding: '2rem' }}>Loading example...</div>;
}

export default function ExamplesApp(): JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/chart" element={<ChartDemoPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route path="/brewflow-sidecar" element={<SidecarNotePage />} />
        <Route path="/brewflow-memory" element={<MemorySubsystemPage />} />
        <Route path="/brewflow-comparison" element={<ComparisonPage />} />
        <Route path="/brewflow-multiuser" element={<MultiUserPage />} />
        <Route path="/slides-demo" element={<SlidesDemoPage />} />
        <Route path="/whiteboard-arch" element={<WhiteboardArchPage />} />
        <Route path="/theme-gallery" element={<ThemeGalleryPage />} />
        <Route path="/views" element={<ViewDemoPage />} />
        <Route path="/input-showcase" element={<InputShowcasePage />} />
        <Route path="/core-showcase" element={<CoreShowcasePage />} />
        <Route path="/media-screen-demo" element={<MediaScreenDemoPage />} />
        <Route
          path="/"
          element={
            <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
              <h1>BrewSite Examples</h1>
              <ul>
                <li><a href="/examples/chart">Chart Demo</a></li>
                <li><a href="/examples/architecture">Package Architecture</a></li>
                <li><a href="/examples/brewflow-memory">BrewFlow Memory Subsystem</a></li>
                <li><a href="/examples/brewflow-comparison">Memory Systems Compared: claude-flow vs BrewFlow</a></li>
                <li><a href="/examples/brewflow-sidecar">BrewFlow Memory Sidecar</a></li>
                <li><a href="/examples/brewflow-multiuser">BrewFlow Memory at Scale: Multi-User Cloud Architecture</a></li>
                <li><a href="/examples/slides-demo">Slides Demo — @brewsite/slides</a></li>
                <li><a href="/examples/whiteboard-arch">Whiteboard Architecture</a></li>
                <li><a href="/examples/theme-gallery">Theme Family Gallery (all 12 variants)</a></li>
                <li><a href="/examples/views">View/ViewLayout Demo</a></li>
                <li><a href="/examples/input-showcase">Input Options Showcase</a></li>
                <li><a href="/examples/core-showcase">Core Showcase — @brewsite/core Features</a></li>
                <li><a href="/examples/media-screen-demo">MediaScreen Demo — @brewsite/screens</a></li>
              </ul>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
