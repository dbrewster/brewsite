import {describe, expect, it} from 'vitest';
import {resolveSceneFromDsl} from '../sceneDslCompiler';
import {Ambient, Animation, Lighting, Model, Motion, Playback, Ribbon, Scene, Spot,} from '../primitives';
import type {SceneFrameContext} from '../sceneTypes';
import {createTestTimeline} from './compilerE2eUtils';
import {TEST_RIBBON_CONFIG} from '../../__tests__/fixtures/testSceneFixtures';

const createContext = (): SceneFrameContext => {
  const timeline = createTestTimeline(['scene']);
  return {
    progress: 0,
    sceneProgress: 0,
    globalProgress: 0,
    sceneStart: 0,
    sceneEnd: 1,
    assetsReady: true,
    timeline,
  };
};

describe('scene DSL handlers', () => {
  it('merges lighting primitives', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Lighting intensityScale={2} color="#00ff00">
          <Ambient intensity={3} color="#ffffff" />
          <Spot
            intensity={5}
            color="#ffffff"
            position={[1, 2, 3]}
            target={[0, 0, 0]}
            angle={Math.PI}
            penumbra={0.8}
            distance={100}
            decay={0.2}
          />
        </Lighting>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.lighting.intensityScale).toBe(2);
    expect(resolved.frame.lighting.color).toBe('#00ff00');
    expect(resolved.frame.lighting.ambient.intensity).toBe(3);
    expect(resolved.frame.lighting.spots?.length).toBe(1);
    expect(resolved.frame.lighting.spots?.[0]?.intensity).toBe(5);
  });

  it('resolves lighting children by displayName when modules differ', () => {
    const context = createContext();
    const FakeAmbient = (_props: { intensity: number; color: string }) => null;
    FakeAmbient.displayName = 'Ambient';
    const FakeSpot = (_props: { intensity: number; color: string; position: [number, number, number]; target: [number, number, number]; angle: number; penumbra: number; distance: number; decay: number }) => null;
    FakeSpot.displayName = 'Spot';
    const tree = (
      <Scene id="scene" index={0}>
        <Lighting intensityScale={1}>
          <FakeAmbient intensity={1.5} color="#ffffff" />
          <FakeSpot
            intensity={4}
            color="#ffffff"
            position={[1, 2, 3]}
            target={[0, 0, 0]}
            angle={Math.PI}
            penumbra={0.5}
            distance={100}
            decay={1}
          />
        </Lighting>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.lighting.ambient.intensity).toBe(1.5);
    expect(resolved.frame.lighting.spots?.length).toBe(1);
    expect(resolved.frame.lighting.spots?.[0]?.intensity).toBe(4);
  });

  it('applies ribbon config', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Ribbon enabled={false} config={{ ...TEST_RIBBON_CONFIG, opacity: 0.15 }} />
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.ribbon.enabled).toBe(false);
    expect(resolved.frame.ribbon.config?.opacity).toBe(0.15);
  });

  it('applies playback motion/animation', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="primary">
          <Playback>
            <Motion commands={[{ groupId: 'robot', rotate: { yawPct: 0.1 } }]} scenes={[]} />
            <Animation enabled={false} />
          </Playback>
        </Model>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.models?.primary?.playback.motion.commands.length).toBe(1);
    expect(resolved.frame.models?.primary?.playback.animation.enabled).toBe(false);
  });

  it('applies playback to a named model instance', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="secondary">
          <Playback>
            <Motion commands={[{ groupId: 'robot', rotate: { yawPct: 0.2 } }]} scenes={[]} />
            <Animation enabled={true} clipName="Idle" />
          </Playback>
        </Model>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.models?.secondary?.playback.motion.commands.length).toBe(1);
    expect(resolved.frame.models?.secondary?.playback.animation.clipName).toBe('Idle');
  });

  it('throws when playback is outside of a model', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Playback>
          <Motion commands={[]} scenes={[]} />
        </Playback>
      </Scene>
    );
    expect(() => resolveSceneFromDsl(tree, context)).toThrow('<Playback> must be nested inside <Model>.');
  });

  it('applies model overrides', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="primary" metalness={0.5} roughness={0.2} />
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.models?.primary?.model.metalness).toBe(0.5);
    expect(resolved.frame.models?.primary?.model.roughness).toBe(0.2);
  });
});
