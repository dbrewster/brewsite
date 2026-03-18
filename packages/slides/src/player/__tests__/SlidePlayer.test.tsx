// packages/slides/src/player/__tests__/SlidePlayer.test.tsx
// Tests for SlidePlayer component.
// Mocks @brewsite/core to avoid Three.js initialization in node environment.
// Uses renderToStaticMarkup (node environment — no DOM required).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ─── Mock @brewsite/core ──────────────────────────────────────────────────────
// SceneEngine, SceneCanvas, EngineOverlayHost require Three.js and DOM which
// are not available in node test environment. We replace them with lightweight stubs.

vi.mock('@brewsite/core', async () => {
  const ReactModule = await import('react');
  const R = ReactModule.default;

  /** SceneEngine stub — renders children inside a labelled div. */
  const SceneEngine = ({
    children,
    id,
  }: {
    children?: ReactModule.ReactNode;
    id?: string;
    [key: string]: unknown;
  }) =>
    R.createElement(
      'div',
      { 'data-testid': 'engine-provider', 'data-engine-id': id ?? '' },
      children,
    );

  /** EngineARContainer stub — passes children through. */
  const EngineARContainer = ({
    children,
  }: {
    children?: ReactModule.ReactNode;
    [key: string]: unknown;
  }) => R.createElement('div', { 'data-testid': 'ar-container' }, children);

  /** SceneCanvas stub — forwardRef returns a canvas element. */
  const SceneCanvas = R.forwardRef<HTMLCanvasElement>(
    function SceneCanvas(_props, _ref) {
      return R.createElement('canvas', { 'data-testid': 'scene-canvas' });
    },
  );

  /** EngineOverlayHost stub — renders nothing. */
  const EngineOverlayHost = () => null;

  /** Scene stub — renders a div with the scene id for structural assertions. */
  const Scene = ({
    children,
    id,
  }: {
    children?: ReactModule.ReactNode;
    id: string;
    [key: string]: unknown;
  }) =>
    R.createElement(
      'div',
      { 'data-testid': 'scene', 'data-scene-id': id },
      children,
    );

  /** TextBox stub — passes children through with a data attribute. */
  const TextBox = ({
    children,
    id,
  }: {
    children?: ReactModule.ReactNode;
    id?: string;
    [key: string]: unknown;
  }) =>
    R.createElement(
      'div',
      { 'data-testid': 'textbox', 'data-textbox-id': id ?? '' },
      children,
    );

  /** ProgressManager stub — renders nothing. */
  const ProgressManager = () => null;

  /** DSL element stubs — compiled, not rendered. Return null. */
  const Floor = () => null;
  const Background = () => null;
  const Lighting = ({ children }: { children?: ReactModule.ReactNode }) =>
    R.createElement(R.Fragment, null, children);
  const Ambient = () => null;

  return {
    // Components
    SceneEngine,
    EngineARContainer,
    SceneCanvas,
    EngineOverlayHost,
    Scene,
    TextBox,
    ProgressManager,
    Floor,
    Background,
    Lighting,
    Ambient,

    // Plugin factory stubs
    corePlugin: () => ({ createWidgets: () => [], registerHandlers: () => {} }),
    registerNode: vi.fn(),

    // Hook stubs (called inside SlidePlayerInner which renders in the mocked tree)
    useCurrentScene: () => ({ id: '', index: 0 }),
    useSceneEngineContext: () => ({
      setProgress: vi.fn(),
      frameState: { tickIndex: 0, sceneId: '', progress: 0 },
    }),
    useVariable: () => null,
  };
});

// ─── Import under test (after mocks are hoisted) ─────────────────────────────

import { SlidePlayer, SlideContentWithProgress } from '../SlidePlayer';
import {
  Slide,
  TitleLayout,
  TitleBodyLayout,
  BulletList,
} from '../../dsl';
import type { SlidePlayerHandle } from '../../types';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SlidePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Structural rendering ─────────────────────────────────────────────────

  it('renders a container div as the outermost element', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="intro"><TitleLayout title="Introduction" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('<div');
    expect(html).toContain('position:relative');
  });

  it('renders the SceneEngine stub for a 3-slide deck', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
        <Slide key="s2"><TitleLayout title="S2" /></Slide>
        <Slide key="s3"><TitleLayout title="S3" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('data-testid="engine-provider"');
  });

  it('renders 3 scene elements for a 3-slide deck', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
        <Slide key="s2"><TitleLayout title="S2" /></Slide>
        <Slide key="s3"><TitleLayout title="S3" /></Slide>
      </SlidePlayer>,
    );
    const sceneMatches = html.match(/data-testid="scene"/g);
    expect(sceneMatches).toHaveLength(3);
  });

  it('renders scene elements with correct IDs matching Slide keys', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="intro"><TitleLayout title="Introduction" /></Slide>
        <Slide key="features">
          <TitleBodyLayout title="Features">
            <BulletList items={['Fast', 'Flexible', 'Composable']} />
          </TitleBodyLayout>
        </Slide>
        <Slide key="outro"><TitleLayout title="Thank You" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('data-scene-id="intro"');
    expect(html).toContain('data-scene-id="features"');
    expect(html).toContain('data-scene-id="outro"');
  });

  it('renders only Slide children — ignores non-Slide elements', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="only"><TitleLayout title="Only" /></Slide>
        <div>ignored</div>
      </SlidePlayer>,
    );
    const sceneMatches = html.match(/data-testid="scene"/g);
    expect(sceneMatches).toHaveLength(1);
    expect(html).toContain('data-scene-id="only"');
  });

  it('renders progress indicator dots by default (one button per slide)', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
        <Slide key="s2"><TitleLayout title="S2" /></Slide>
        <Slide key="s3"><TitleLayout title="S3" /></Slide>
      </SlidePlayer>,
    );
    // Dots = buttons. Default progressIndicator='dots' → 3 buttons for 3 slides.
    const buttonMatches = html.match(/<button/g);
    expect(buttonMatches).toHaveLength(3);
  });

  it('renders no progress indicator buttons when progressIndicator="none"', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer progressIndicator="none">
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
        <Slide key="s2"><TitleLayout title="S2" /></Slide>
        <Slide key="s3"><TitleLayout title="S3" /></Slide>
      </SlidePlayer>,
    );
    expect(html).not.toContain('<button');
  });

  it('renders pointer overlay by default (aria-hidden div)', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('aria-hidden');
  });

  it('omits pointer overlay when navigation.pointer=false', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer navigation={{ pointer: false }}>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
      </SlidePlayer>,
    );
    expect(html).not.toContain('aria-hidden');
  });

  it('applies custom className to the outer container', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer className="my-slide-player">
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('class="my-slide-player"');
  });

  it('renders SceneCanvas stub inside the input region', () => {
    const html = renderToStaticMarkup(
      <SlidePlayer>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
      </SlidePlayer>,
    );
    expect(html).toContain('data-testid="scene-canvas"');
  });

  // ─── SlidePlayerHandle interface ──────────────────────────────────────────
  // The imperative handle is only populated by useImperativeHandle inside
  // SlidePlayerInner, which does not execute during renderToStaticMarkup
  // (effects and imperative handles do not run in server rendering).
  // We verify the TypeScript shape by creating a typed ref and confirming
  // it is accepted by forwardRef<SlidePlayerHandle, SlidePlayerProps>.

  it('accepts a SlidePlayerHandle ref without TypeScript error', () => {
    const ref = React.createRef<SlidePlayerHandle>();
    const html = renderToStaticMarkup(
      <SlidePlayer ref={ref}>
        <Slide key="s1"><TitleLayout title="S1" /></Slide>
      </SlidePlayer>,
    );
    // Component renders correctly (would throw if types were wrong)
    expect(html).toContain('<div');
    // ref.current is null in server render — expected behaviour
    expect(ref.current).toBeNull();
  });
});

// ─── SlideContentWithProgress ────────────────────────────────────────────────

describe('SlideContentWithProgress', () => {
  // SlideContentWithProgress reads sceneProgress via useVariable (mocked to
  // return null → progress=0 throughout these tests).

  it('renders children when totalBullets is 0', () => {
    const html = renderToStaticMarkup(
      <SlideContentWithProgress slideKey="s1" totalBullets={0}>
        <span>Hello</span>
      </SlideContentWithProgress>,
    );
    expect(html).toContain('Hello');
  });

  it('passes non-list children through unchanged', () => {
    const html = renderToStaticMarkup(
      <SlideContentWithProgress slideKey="s1" totalBullets={3}>
        <p>Paragraph content</p>
      </SlideContentWithProgress>,
    );
    expect(html).toContain('Paragraph content');
  });

  it('injects visibleCount=0 into BulletList when sceneProgress=0 (useVariable returns null)', () => {
    // useVariable mocked to return null → progress=0 → visibleCount=ceil(0*3)=0
    const html = renderToStaticMarkup(
      <SlideContentWithProgress slideKey="s1" totalBullets={3}>
        <BulletList items={['A', 'B', 'C']} animateEntrance />
      </SlideContentWithProgress>,
    );
    // BulletList with visibleCount=0 renders no <li> elements
    const liCount = (html.match(/<li/g) ?? []).length;
    expect(liCount).toBe(0);
  });

  it('does not inject visibleCount for BulletList without animateEntrance', () => {
    // BulletList with animateEntrance=false should render all items
    const html = renderToStaticMarkup(
      <SlideContentWithProgress slideKey="s1" totalBullets={3}>
        <BulletList items={['A', 'B', 'C']} />
      </SlideContentWithProgress>,
    );
    // All 3 items should render (animateEntrance not set, so no visibleCount injection)
    const liCount = (html.match(/<li/g) ?? []).length;
    expect(liCount).toBe(3);
  });
});
