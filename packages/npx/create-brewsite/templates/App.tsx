import { SceneEngine, SceneCanvas, EngineOverlayHost, ScrollStage } from '@brewsite/core/player';
import { corePlugin } from '@brewsite/core/player';
import { IntroScene } from './scenes/intro';

export default function App() {
  return (
    <ScrollStage>
      <SceneEngine
        plugins={[corePlugin()]}
        getFrame={() => <IntroScene />}
      >
        <SceneCanvas />
        <EngineOverlayHost />
      </SceneEngine>
    </ScrollStage>
  );
}
