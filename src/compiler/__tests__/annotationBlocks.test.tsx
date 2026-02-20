import { describe, it, expect } from 'vitest';
import { Annotations, MessageAnnotation, Scene, resolveSceneFromDsl } from '../index';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { createSceneTimeline } from '../../timeline';
import type { SceneFrameContext } from '../sceneTypes';
import type { AnnotationPlacement } from '../../annotations/annotationTypes';

describe('annotationBlocks', () => {
  const makeContext = (): SceneFrameContext => {
    const timeline = createSceneTimeline([{ id: 'scene' }]);
    return {
      progress: 0,
      sceneProgress: 0,
      globalProgress: 0,
      sceneStart: 0,
      sceneEnd: 1,
      assetsReady: false,
      timeline,
    };
  };

  it('compiles MessageAnnotation into scene annotations with defaults', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" label="Hello" content={<div>Hi</div>} />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.id).toBe('note');
    expect(annotations[0]?.label).toBe('Hello');
    expect(annotations[0]?.placement).toEqual({
      mode: 'fixed',
      reference: { x: 'center', y: 'middle' },
      offset: { xPct: 0, yPct: 0 },
    });
    expect(annotations[0]?.content && 'node' in annotations[0].content).toBe(true);
  });

  it('defaults label to id when label is omitted', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" content={<div>Hi</div>} />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.label).toBe('note');
  });

  it('leaves enabled undefined when not provided', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" content={<div>Hi</div>} />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.enabled).toBeUndefined();
  });

  it('prefers contentId over content and children', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" contentId="hero" content={<div>Ignored</div>}>
            <div>Also ignored</div>
          </MessageAnnotation>
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.content).toEqual({ contentId: 'hero' });
  });

  it('uses children as content when content and contentId are unset', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note">
            <div>Child content</div>
          </MessageAnnotation>
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.content && 'node' in annotations[0].content).toBe(true);
  });

  it('leaves content undefined when nothing is provided', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.content).toBeUndefined();
  });

  it('resolves functional placement, label, enabled, and style', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation
            id="note"
            label={(ctx) => `p-${ctx.sceneProgress}`}
            enabled={(ctx) => ctx.sceneProgress === 0}
            placement={(ctx) => ({
              mode: 'fixed',
              reference: { x: 'left', y: 'top' },
              offset: { xPct: ctx.sceneProgress * 10, yPct: 5 },
            })}
            style={(ctx) => ({
              color: ctx.sceneProgress === 0 ? '#fff' : undefined,
              backgroundColor: undefined,
            })}
          />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.label).toBe('p-0');
    expect(annotations[0]?.enabled).toBe(true);
    expect(annotations[0]?.placement).toEqual({
      mode: 'fixed',
      reference: { x: 'left', y: 'top' },
      offset: { xPct: 0, yPct: 5 },
    });
    expect(annotations[0]?.style).toEqual({ color: '#fff' });
  });

  it('uses default placement when placement is not provided', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.placement).toEqual({
      mode: 'fixed',
      reference: { x: 'center', y: 'middle' },
      offset: { xPct: 0, yPct: 0 },
    });
  });

  it('strips undefined fields from style object', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation
            id="note"
            style={{
              color: '#fff',
              backgroundColor: undefined,
              borderRadius: undefined,
            }}
          />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.style).toEqual({ color: '#fff' });
  });

  it('omits style when all style fields are undefined', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="note" style={{ color: undefined }} />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.style).toBeUndefined();
  });

  it('resolves nested placement values from functions', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation
            id="note"
            placement={{
              mode: 'fixed',
              reference: {
                x: ((ctx: SceneFrameContext) => (ctx.sceneProgress > 0.5 ? 'right' : 'left')) as unknown as 'left',
                y: 'bottom',
              },
              offset: {
                xPct: (ctx: SceneFrameContext) => ctx.sceneProgress * 20,
                yPct: 10,
              },
            } as unknown as AnnotationPlacement}
          />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.placement).toEqual({
      mode: 'fixed',
      reference: { x: 'left', y: 'bottom' },
      offset: { xPct: 0, yPct: 10 },
    });
  });

  it('supports multiple annotations and preserves order', () => {
    const context = makeContext();
    const registry = new WidgetRegistry();

    const tree = (
      <Scene id="scene">
        <Annotations>
          <MessageAnnotation id="first" label="First" />
          <MessageAnnotation id="second" label="Second" />
        </Annotations>
      </Scene>
    );

    const result = resolveSceneFromDsl(tree, context, registry);
    const annotations = result.frame.annotations ?? [];

    expect(annotations).toHaveLength(2);
    expect(annotations[0]?.id).toBe('first');
    expect(annotations[1]?.id).toBe('second');
  });
});
