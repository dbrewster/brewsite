import {
  Ambient,
  Directional,
  Lighting,
  type ScrollStageHandle,
  type ThemePolarity,
  TimelineWidget,
  useSceneEngineContext
} from "@brewsite/core";
import {config} from "./settings";
import {JSX, RefObject, useCallback} from "react";

// Re-export ThemeToggle and LightDarkToggle from their new home for backward compat.
export { ThemeToggle, LightDarkToggle } from './ThemeToggle';
export type { ThemeToggleProps, LightDarkToggleProps } from './ThemeToggle';

export const Lights = () => (
  <Lighting intensityScale={1}>
    <Ambient intensity={2.6} color="#8899cc"/>
    <Directional id={'d1'} intensity={.4} color={config.lightColor} position={[config.lightOffset, config.lightOffset, 10]}/>
    <Directional id={'d2'} intensity={.4} color={config.lightColor} position={[0, config.lightOffset, 10]}/>
    <Directional id={'d3'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, config.lightOffset, 10]}/>
    <Directional id={'d4'} intensity={.4} color={config.lightColor} position={[config.lightOffset, 0, 10]}/>
    <Directional id={'d5'} intensity={.4} color={config.lightColor} position={[0, 0, 10]}/>
    <Directional id={'d6'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, 0, 10]}/>
    <Directional id={'d7'} intensity={.4} color={config.lightColor} position={[config.lightOffset, -config.lightOffset, 10]}/>
    <Directional id={'d8'} intensity={.4} color={config.lightColor} position={[0, -config.lightOffset, 10]}/>
    <Directional id={'d9'} intensity={.4} color={config.lightColor} position={[-config.lightOffset, -config.lightOffset, 10]}/>
  </Lighting>
)

type ChartProgressIndicatorProps = {
  scrollStageRef: RefObject<ScrollStageHandle | null>;
  polarity: ThemePolarity;
};

export function ChartProgressIndicator({ scrollStageRef, polarity }: ChartProgressIndicatorProps): JSX.Element {
  const engine = useSceneEngineContext();
  const handleSeek = useCallback((progress: number): void => {
    const rawProgress = engine.progressMapper ? engine.progressMapper.inverse(progress) : progress;
    if (scrollStageRef.current) {
      scrollStageRef.current.scrollToProgress(rawProgress);
      return;
    }
    engine.setProgress(progress);
  }, [engine, scrollStageRef]);

  return (
    <TimelineWidget
      engine={engine}
      theme={polarity === 'light' ? 'light' : 'dark'}
      position="bottom"
      thickness={36}
      majorTicks="scene"
      minorTicksPerScene={10}
      showSceneLabels={false}
      showProgress
      scrubEnabled
      onSeek={handleSeek}
      style={{ zIndex: 20, left: 0, right: 0, bottom: 0, borderRadius: 10 }}
    />
  );
}
