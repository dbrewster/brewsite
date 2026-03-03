import type { JSX } from 'react';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

const ChartDemoPage = lazy(() => import('./chart/ChartDemoPage'));
const ArchitecturePage = lazy(() => import('./architecture/ArchitecturePage'));

function Loading(): JSX.Element {
  return <div style={{ padding: '2rem' }}>Loading example...</div>;
}

export default function ExamplesApp(): JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/chart" element={<ChartDemoPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route
          path="/"
          element={
            <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
              <h1>BrewSite Examples</h1>
              <ul>
                <li><a href="/examples/chart">Chart Demo</a></li>
                <li><a href="/examples/architecture">Package Architecture</a></li>
              </ul>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
