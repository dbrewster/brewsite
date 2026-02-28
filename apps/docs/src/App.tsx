import { JSX } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { DocLayout } from './components/layout/DocLayout';
import { coreNav } from './nav/core-nav';
import { diagramNav } from './nav/diagram-nav';

function PlaceholderPage({ title }: { title: string }): JSX.Element {
  const location = useLocation();

  return (
    <section>
      <h1>{title}</h1>
      <p>Page scaffolded in docs app. Content implementation starts in Phase 4+.</p>
      <p>
        Current route: <code>{location.pathname}</code>
      </p>
    </section>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/core/getting-started" replace />} />
      <Route path="/core/*" element={<DocLayout book="core" nav={coreNav} />}>
        <Route path="getting-started" element={<PlaceholderPage title="What Is BrewSite Core?" />} />
        <Route path="*" element={<PlaceholderPage title="Core Docs" />} />
      </Route>
      <Route path="/diagram/*" element={<DocLayout book="diagram" nav={diagramNav} />}>
        <Route path="getting-started" element={<PlaceholderPage title="Diagram Docs" />} />
        <Route path="*" element={<PlaceholderPage title="Diagram Docs" />} />
      </Route>
    </Routes>
  );
}
