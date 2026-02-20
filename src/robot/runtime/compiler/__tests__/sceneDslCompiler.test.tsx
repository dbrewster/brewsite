import {describe, expect, it, vi} from 'vitest';
import {resolveSceneFromDsl} from '../sceneDslCompiler';
import {Annotation, Annotations, ContainedModel, Model, ModelPart, Scene, Subpart} from '../primitives';
import type {SceneFrameContext} from '../sceneTypes';
import {createTestTimeline} from './compilerE2eUtils';
import {createBaseSceneState, createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';
import {resourceRegistry} from '../../../../resources/sceneResources.generated';

const createContext = (overrides?: Partial<SceneFrameContext>): SceneFrameContext => {
  const timeline = createTestTimeline(['scene']);
  return {
    progress: 0,
    sceneProgress: 0,
    globalProgress: 0,
    sceneStart: 0,
    sceneEnd: 1,
    assetsReady: true,
    timeline,
    ...overrides,
  };
};

const Badge = ({ id }: { id: string }) => (
  <Annotation
    id={id}
    label="Badge"
    mode="world"
    targetPartId="chest_anchor"
    labelOffset={[0, 1, 2]}
    content={{ node: <div>Badge</div> }}
    style={{ labelOpacity: 0.5 }}
  />
);

describe('scene DSL compiler', () => {
  it('resolves annotation props and content', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Annotations>
          <Annotation
            id="hero"
            label="Hero"
            mode="screen"
            content={{ node: <span>Hero</span> }}
            labelAnchor={{
              reference: { x: 'left', y: 'top' },
              offset: { xPct: 0.1, yPct: 0.2 },
            }}
            style={{ labelOpacity: 0.7 }}
          />
        </Annotations>
      </Scene>
    );

    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.annotations?.[0]?.id).toBe('hero');
    expect(resolved.frame.annotations?.[0]?.content?.node).toBeDefined();
    expect(resolved.frame.annotations?.[0]?.labelAnchor).toBeDefined();
  });

  it('expands functional annotation helpers', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Annotations>
          <Badge id="badge" />
        </Annotations>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.annotations?.[0]?.id).toBe('badge');
    expect(resolved.frame.annotations?.[0]?.label).toBe('Badge');
  });

  it('maps model parts from primitives', () => {
    const context = createContext();
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="primary" position={[1, 2, 3]}>
          <ModelPart id="brain" enabled opacity={0.2} />
        </Model>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    expect(resolved.frame.models?.primary?.model.position).toEqual([1, 2, 3]);
    expect(resolved.frame.models?.primary?.model.parts?.brain?.enabled).toBe(true);
    expect(resolved.frame.models?.primary?.model.parts?.brain?.opacity).toBeCloseTo(0.2);
  });

  it('applies model part defaults from the registry', () => {
    const context = createContext({ resourceRegistry });
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="robot">
          <ModelPart id="brain" />
        </Model>
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, context);
    const part = resolved.frame.models?.robot?.model.parts?.brain;
    expect(part?.anchor).toBe('head');
    expect(part?.position).toEqual([0.5, -3, 12.5]);
    expect(part?.rotation).toEqual([-0.242, 0, 0]);
    expect(part?.scale).toBe(57);
  });

  it('warns when subpart ids are unknown to the registry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = createContext({ resourceRegistry });
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="robot">
          <ModelPart id="brain">
            <ContainedModel modelId="brain">
              <Subpart id="not-a-subpart" />
            </ContainedModel>
          </ModelPart>
        </Model>
      </Scene>
    );
    resolveSceneFromDsl(tree, context);
    const hasUnknownSubpart = warnSpy.mock.calls.some((call) => call[1] === 'unknown.subpart');
    warnSpy.mockRestore();
    expect(hasUnknownSubpart).toBe(true);
  });

  it('clears pose groups when none are defined in the scene', () => {
    const context = createContext();
    const baseState = createBaseSceneState(context);
    const basePose = {
      mode: 'override' as const,
      groups: {
        head: { rotate: { yawPct: 0.3 } },
      },
    };
    const basePlayback = createDefaultPlayback();
    const baseWithPose = {
      ...baseState,
      models: {
        primary: {
          model: createDefaultModelState(),
          playback: {
            ...basePlayback,
            motion: {
              ...basePlayback.motion,
              pose: basePose,
            },
          },
        },
      },
    };
    const tree = (
      <Scene id="scene" index={0}>
        <Model id="primary" />
      </Scene>
    );
    const resolved = resolveSceneFromDsl(tree, { ...context, baseState: baseWithPose });
    expect(resolved.frame.models?.primary?.playback.motion.pose).toBeUndefined();
  });
});
