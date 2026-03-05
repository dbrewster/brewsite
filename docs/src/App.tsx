// docs/src/App.tsx
import type { ReactElement } from 'react';
import { DocsApp } from '@brewsite/docs';
import { docsNav } from './docs-nav';

// Core pages — all mount eagerly (no React.lazy — continuous-scroll model)
import { GettingStartedPage } from './pages/core/GettingStarted';
import { InstallationPage } from './pages/core/Installation';
import { QuickStartPage } from './pages/core/QuickStart';
import { CoreConceptsPage } from './pages/core/CoreConcepts';
import { SceneDslPage } from './pages/core/SceneDsl';
import { MultiScenePage } from './pages/core/MultiScene';
import { TransitionsPage } from './pages/core/Transitions';
import { ModelPage } from './pages/core/ModelElement';
import { CameraPage } from './pages/core/CameraElement';
import { LightingPage } from './pages/core/LightingElement';
import { BackgroundPage } from './pages/core/BackgroundElement';
import { EnvironmentPage } from './pages/core/EnvironmentElement';
import { FloorPage } from './pages/core/FloorElement';
import { HudPage } from './pages/core/HudOverview';
import { HudAnimeJsPage } from './pages/core/HudAnimejs';
import { LabelSystemPage } from './pages/core/LabelSystem';
import { NavigationPage } from './pages/core/Navigation';
import { ActionsPage } from './pages/core/Actions';
import { ScenePlayerPage } from './pages/core/ScenePlayerRef';
import { HooksPage } from './pages/core/Hooks';
import { WidgetSdkPage } from './pages/core/Concepts';
import { CustomWidgetPage } from './pages/core/CustomWidget';
import { VariableStorePage } from './pages/core/VariableStore';
import { RegistryPage } from './pages/core/Registry';
import { ApiReferencePage } from './pages/core/ApiReference';
import { TimelinePage } from './pages/core/TimelineApi';

export default function App(): ReactElement {
  return (
    <DocsApp nav={docsNav}>
      <GettingStartedPage />
      <InstallationPage />
      <QuickStartPage />
      <CoreConceptsPage />
      <SceneDslPage />
      <MultiScenePage />
      <TransitionsPage />
      <ModelPage />
      <CameraPage />
      <LightingPage />
      <BackgroundPage />
      <EnvironmentPage />
      <FloorPage />
      <HudPage />
      <HudAnimeJsPage />
      <LabelSystemPage />
      <NavigationPage />
      <ActionsPage />
      <ScenePlayerPage />
      <HooksPage />
      <WidgetSdkPage />
      <CustomWidgetPage />
      <VariableStorePage />
      <RegistryPage />
      <ApiReferencePage />
      <TimelinePage />
    </DocsApp>
  );
}
