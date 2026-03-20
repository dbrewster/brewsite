import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  corePlugin, SceneEngine, SceneCanvas, ScrollStage, InputCoordinator,
  BackgroundLayer, EngineARContainer, EngineOverlayHost,
  useSceneEngineContext, type CarouselSelectEvent, type WidgetPlugin,
  type ScrollStageHandle, type ActiveTheme,
} from '@brewsite/core';
import { chartPlugin, ChartTooltipHost } from '@brewsite/charts';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';

import { PickerScene } from './scenes/scenePicker';
import { ChartDetailScene } from './scenes/sceneChartDetail';
import { DiagramDetailScene } from './scenes/sceneDiagramDetail';
import { ExplorerOverlay } from './overlays/ExplorerOverlay';
import { FullScreenCloseButton } from './overlays/FullScreenCloseButton';
import { ExampleHeader, useFpsCap } from '../ExampleHeader';
import { StatsOverlay } from '../StatsOverlay';

function createPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [corePlugin(), chartPlugin(), diagramPlugin(), themesPlugin()],
  };
}

/**
 * Inner component that has access to the scene engine via useSceneEngineContext().
 * Must be rendered inside <SceneEngine>.
 */
function SelectionHandler(): JSX.Element | null {
  const engine = useSceneEngineContext();
  const [showExplorer, setShowExplorer] = useState(false);
  const [isDetail, setIsDetail] = useState(false);

  const handleSelect = useCallback((event: CarouselSelectEvent) => {
    event.preventDefault();

    if (event.viewId === 'chart-view' || event.viewId === 'diagram-view') {
      // Pattern A: Scene navigation — transition to the matching detail scene
      const targetSceneId = `detail-${event.viewId}`;
      const targetProgress = engine.getSceneProgress(targetSceneId);
      engine.beginTransition(targetProgress, 600);
      setIsDetail(true);
    } else if (event.viewId === 'explorer-view') {
      // Pattern B: React overlay — mount a separate scroll stage
      setShowExplorer(true);
    }
  }, [engine]);

  const handleBack = useCallback(() => {
    const pickerProgress = engine.getSceneProgress('picker');
    engine.beginTransition(pickerProgress, 400);
    setIsDetail(false);
  }, [engine]);

  const handleCloseExplorer = useCallback(() => {
    setShowExplorer(false);
  }, []);

  return (
    <>
      {/* The picker scene receives onSelect as a prop */}
      <PickerScene onSelect={handleSelect} />
      <ChartDetailScene />
      <DiagramDetailScene />

      {/* Close button appears when viewing chart or diagram detail scenes */}
      {isDetail && <FullScreenCloseButton onClick={handleBack} />}

      {/* Explorer overlay mounts as a completely separate React experience */}
      {showExplorer && <ExplorerOverlay onClose={handleCloseExplorer} />}
    </>
  );
}

export default function CarouselSelectionPage(): JSX.Element {
  const { plugins } = useMemo(() => createPlugins(), []);
  const scrollStageRef = useRef<ScrollStageHandle | null>(null);
  const theme = useMemo((): ActiveTheme => ({
    family: 'darkGlass', polarity: 'dark',
  }), []);
  const fpsCap = useFpsCap();

  return (
    <div style={{
      position: 'relative', display: 'flex', flexFlow: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 0%, #12345d 0%, #061326 42%, #020812 72%, #01040a 100%)',
    }}>
      <ExampleHeader />
      <SceneEngine plugins={plugins} theme={theme} timingProfile={{ fpsCap }}>
        <SelectionHandler />
        <ScrollStage ref={scrollStageRef} scrollHeightMode="scene-count" pixelsPerScene={500}>
          <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-width">
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost passthroughPointerEvents>
              <ChartTooltipHost />
            </EngineOverlayHost>
          </EngineARContainer>
          <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
        </ScrollStage>
        <StatsOverlay />
      </SceneEngine>
    </div>
  );
}
