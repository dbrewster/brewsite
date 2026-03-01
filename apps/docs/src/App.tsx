import { JSX, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { DocLayout } from './components/layout/DocLayout';
import { coreNav } from './nav/core-nav';
import { diagramNav } from './nav/diagram-nav';
import { modelNav } from './nav/model-nav';

// Getting Started
const GettingStarted = lazy(() => import('./pages/core/GettingStarted'));
const Installation = lazy(() => import('./pages/core/Installation'));
const QuickStart = lazy(() => import('./pages/core/QuickStart'));
const CoreConcepts = lazy(() => import('./pages/core/CoreConcepts'));

// Scene Authoring
const SceneDsl = lazy(() => import('./pages/core/SceneDsl'));
const MultiScene = lazy(() => import('./pages/core/MultiScene'));
const Transitions = lazy(() => import('./pages/core/Transitions'));
const ProgressManager = lazy(() => import('./pages/core/ProgressManager'));

// Elements
const ModelElement = lazy(() => import('./pages/model/ModelElement'));
const CameraElement = lazy(() => import('./pages/core/CameraElement'));
const LightingElement = lazy(() => import('./pages/core/LightingElement'));
const BackgroundElement = lazy(() => import('./pages/core/BackgroundElement'));
const EnvironmentElement = lazy(() => import('./pages/core/EnvironmentElement'));
const FloorElement = lazy(() => import('./pages/core/FloorElement'));

// HUD & Labels
const HudOverview = lazy(() => import('./pages/core/HudOverview'));
const HudAnimejs = lazy(() => import('./pages/core/HudAnimejs'));
const LabelSystem = lazy(() => import('./pages/model/LabelSystem'));
const ModelIntroduction = lazy(() => import('./pages/model/Introduction'));

// Input
const Navigation = lazy(() => import('./pages/core/Navigation'));
const Actions = lazy(() => import('./pages/core/Actions'));

// Player & Hooks
const ScenePlayerRef = lazy(() => import('./pages/core/ScenePlayerRef'));
const Hooks = lazy(() => import('./pages/core/Hooks'));

// Widget SDK
const Concepts = lazy(() => import('./pages/core/Concepts'));
const CustomWidget = lazy(() => import('./pages/core/CustomWidget'));
const VariableStore = lazy(() => import('./pages/core/VariableStore'));
const Registry = lazy(() => import('./pages/core/Registry'));

// Reference
const ApiReference = lazy(() => import('./pages/core/ApiReference'));
const TimelineApi = lazy(() => import('./pages/core/TimelineApi'));

function Fallback(): JSX.Element {
  return <div style={{ padding: '48px 48px', color: 'var(--text-muted)' }}>Loading…</div>;
}

function DiagramPlaceholder({ title }: { title: string }): JSX.Element {
  return (
    <section>
      <h1>{title}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        The @brewsite/diagram documentation is coming soon.
      </p>
    </section>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/core/getting-started" replace />} />

      {/* Core book */}
      <Route path="/core/*" element={<DocLayout book="core" nav={coreNav} />}>
        <Route path="getting-started" element={<Suspense fallback={<Fallback />}><GettingStarted /></Suspense>} />
        <Route path="installation"    element={<Suspense fallback={<Fallback />}><Installation /></Suspense>} />
        <Route path="quick-start"     element={<Suspense fallback={<Fallback />}><QuickStart /></Suspense>} />
        <Route path="concepts"        element={<Suspense fallback={<Fallback />}><CoreConcepts /></Suspense>} />
        <Route path="scene-dsl"         element={<Suspense fallback={<Fallback />}><SceneDsl /></Suspense>} />
        <Route path="multi-scene"       element={<Suspense fallback={<Fallback />}><MultiScene /></Suspense>} />
        <Route path="transitions"       element={<Suspense fallback={<Fallback />}><Transitions /></Suspense>} />
        <Route path="progress-manager"  element={<Suspense fallback={<Fallback />}><ProgressManager /></Suspense>} />
        <Route path="camera"          element={<Suspense fallback={<Fallback />}><CameraElement /></Suspense>} />
        <Route path="lighting"        element={<Suspense fallback={<Fallback />}><LightingElement /></Suspense>} />
        <Route path="background"      element={<Suspense fallback={<Fallback />}><BackgroundElement /></Suspense>} />
        <Route path="environment"     element={<Suspense fallback={<Fallback />}><EnvironmentElement /></Suspense>} />
        <Route path="floor"           element={<Suspense fallback={<Fallback />}><FloorElement /></Suspense>} />
        <Route path="hud"             element={<Suspense fallback={<Fallback />}><HudOverview /></Suspense>} />
        <Route path="hud-animejs"     element={<Suspense fallback={<Fallback />}><HudAnimejs /></Suspense>} />
        <Route path="input-navigation" element={<Suspense fallback={<Fallback />}><Navigation /></Suspense>} />
        <Route path="input-actions"   element={<Suspense fallback={<Fallback />}><Actions /></Suspense>} />
        <Route path="player"          element={<Suspense fallback={<Fallback />}><ScenePlayerRef /></Suspense>} />
        <Route path="hooks"           element={<Suspense fallback={<Fallback />}><Hooks /></Suspense>} />
        <Route path="widget-sdk"      element={<Suspense fallback={<Fallback />}><Concepts /></Suspense>} />
        <Route path="custom-widget"   element={<Suspense fallback={<Fallback />}><CustomWidget /></Suspense>} />
        <Route path="variable-store"  element={<Suspense fallback={<Fallback />}><VariableStore /></Suspense>} />
        <Route path="widget-registry" element={<Suspense fallback={<Fallback />}><Registry /></Suspense>} />
        <Route path="api-reference"   element={<Suspense fallback={<Fallback />}><ApiReference /></Suspense>} />
        <Route path="timeline"        element={<Suspense fallback={<Fallback />}><TimelineApi /></Suspense>} />
        <Route index element={<Navigate to="getting-started" replace />} />
      </Route>

      {/* Diagram book — stub */}
      <Route path="/diagram/*" element={<DocLayout book="diagram" nav={diagramNav} />}>
        <Route path="getting-started" element={<DiagramPlaceholder title="@brewsite/diagram Docs" />} />
        <Route path="*" element={<DiagramPlaceholder title="@brewsite/diagram Docs" />} />
        <Route index element={<Navigate to="getting-started" replace />} />
      </Route>

      {/* Model book */}
      <Route path="/model/*" element={<DocLayout book="model" nav={modelNav} />}>
        <Route path="introduction" element={<Suspense fallback={<Fallback />}><ModelIntroduction /></Suspense>} />
        <Route path="model"        element={<Suspense fallback={<Fallback />}><ModelElement /></Suspense>} />
        <Route path="labels"       element={<Suspense fallback={<Fallback />}><LabelSystem /></Suspense>} />
        <Route index element={<Navigate to="introduction" replace />} />
      </Route>
    </Routes>
  );
}
