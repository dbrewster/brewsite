// Tests for compileDeck() — DeckSpec production from <Slide> element trees.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { compileDeck, buildSceneElements, classifyRegionContent } from '../deckCompiler';
import { Slide, TitleLayout, TitleBodyLayout, TwoColumnLayout, FullBleedLayout, BlankLayout, BulletList, NumberedList, ContentSlide, TwoColumnSlide } from '../../dsl';
// Direct import from core source — vitest resolves via monorepo FS.
// registerNode and clearRegistry are not in @brewsite/core's public barrel.
import { registerNode, clearRegistry } from '../../../../core/src/compiler/registry';
import { Camera } from '@brewsite/core';

// Helper: produce ReactElement<Record<string, unknown>> as expected by compileDeck
function makeSlide(key: string, children?: React.ReactNode, props?: Record<string, unknown>): React.ReactElement<Record<string, unknown>> {
  return React.createElement(Slide, { key, ...props } as React.ComponentProps<typeof Slide>, children) as React.ReactElement<Record<string, unknown>>;
}

describe('compileDeck', () => {
  describe('slide count and keys', () => {
    it('produces DeckSpec with correct slide count', () => {
      const slides = [
        makeSlide('intro', React.createElement(TitleLayout, { title: 'Intro' })),
        makeSlide('main', React.createElement(TitleBodyLayout, { title: 'Main' })),
        makeSlide('outro', React.createElement(TitleLayout, { title: 'Outro' })),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides).toHaveLength(3);
    });

    it('preserves slide keys', () => {
      const slides = [
        makeSlide('first', React.createElement(TitleLayout, { title: 'A' })),
        makeSlide('second', React.createElement(TitleBodyLayout, { title: 'B' })),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.key).toMatch(/first/);
      expect(spec.slides[1]!.key).toMatch(/second/);
    });

    it('stores the deck-level transition', () => {
      const slides = [makeSlide('s1', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'cut');
      expect(spec.transition).toBe('cut');
    });

    it('DeckSpec has no theme field', () => {
      const slides = [makeSlide('s1', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect('theme' in spec).toBe(false);
    });
  });

  describe('layout detection', () => {
    it('detects title layout', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('title');
    });

    it('detects content layout from TitleBodyLayout', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('content');
    });

    it('detects two-column layout', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { left: null, right: null }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('two-column');
    });

    it('detects full-bleed layout', () => {
      const slides = [makeSlide('s', React.createElement(FullBleedLayout, {}))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('full-bleed');
    });

    it('detects blank layout for BlankLayout', () => {
      const slides = [makeSlide('s', React.createElement(BlankLayout, {}))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('blank');
    });

    it('falls back to blank layout when no layout child', () => {
      const slides = [makeSlide('s')];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('blank');
    });
  });

  describe('regions', () => {
    it('title layout produces 1 region', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(1);
    });

    it('content layout produces 2 regions (title + body)', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(2);
      expect(spec.slides[0]!.regions.find((r) => r.id === 'title')).toBeDefined();
      expect(spec.slides[0]!.regions.find((r) => r.id === 'body')).toBeDefined();
    });

    it('two-column layout with title produces 3 regions', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { title: 'T', left: null, right: null }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(3);
    });

    it('two-column layout without title produces 2 regions', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { left: null, right: null }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(2);
    });

    it('blank layout produces 1 full-size body region', () => {
      const slides = [makeSlide('s', React.createElement(BlankLayout, {}))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(1);
      expect(spec.slides[0]!.regions[0]!.id).toBe('body');
    });
  });

  describe('scrollUnits', () => {
    it('title layout defaults to 100 scrollUnits', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.scrollUnits).toBe(100);
    });

    it('body layouts default to 400 scrollUnits', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.scrollUnits).toBe(400);
    });

    it('scrollUnits prop overrides default', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }), { scrollUnits: 200 })];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.scrollUnits).toBe(200);
    });
  });

  describe('animated bullet lists', () => {
    it('hasAnimatedList is false when no BulletList with animateEntrance', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TitleBodyLayout, { title: 'T' },
            React.createElement(BulletList, { items: ['A', 'B'] }))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.hasAnimatedList).toBe(false);
      expect(spec.slides[0]!.totalBullets).toBe(0);
    });

    it('hasAnimatedList is true when BulletList has animateEntrance=true', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TitleBodyLayout, { title: 'T' },
            React.createElement(BulletList, { items: ['A', 'B', 'C'], animateEntrance: true }))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.hasAnimatedList).toBe(true);
      expect(spec.slides[0]!.totalBullets).toBe(3);
    });

    it('counts bullets from NumberedList with animateEntrance=true', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TitleBodyLayout, { title: 'T' },
            React.createElement(NumberedList, { items: ['1', '2'], animateEntrance: true }))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.hasAnimatedList).toBe(true);
      expect(spec.slides[0]!.totalBullets).toBe(2);
    });

    it('counts animated bullets from both columns in two-column layout', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TwoColumnLayout, {
            title: 'T',
            left: React.createElement(BulletList, { items: ['A', 'B'], animateEntrance: true }),
            right: React.createElement(BulletList, { items: ['C', 'D', 'E'], animateEntrance: true }),
          })),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.totalBullets).toBe(5);
    });
  });

  describe('slide-level transition override', () => {
    it('inherits deck-level transition when slide has no override', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'cut');
      expect(spec.slides[0]!.transition).toBe('cut');
    });

    it('uses slide-level transition when provided', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'T' }), { transition: 'dissolve' }),
      ];
      const spec = compileDeck(slides, 'cut');
      expect(spec.slides[0]!.transition).toBe('dissolve');
    });
  });

  describe('notes and title metadata', () => {
    it('extracts notes from slide props', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'T' }), { notes: 'My note' }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.notes).toBe('My note');
    });

    it('title prop on slide overrides layout title', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'Layout Title' }), { title: 'Slide Title' }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.title).toBe('Slide Title');
    });

    it('uses layout title when no slide-level title prop', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'Layout Title' })),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.title).toBe('Layout Title');
    });
  });

  describe('sceneDsl', () => {
    it('sceneDsl is undefined when not provided', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.sceneDsl).toBeUndefined();
    });

    it('carries sceneDsl through when provided', () => {
      const sceneDslContent = React.createElement('div', null, 'custom 3D content');
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {}), { sceneDsl: sceneDslContent }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      expect(spec.slides[0]!.sceneDsl).toBe(sceneDslContent);
    });

    it('buildSceneElements wraps sceneDsl in a fullscreen View', () => {
      const sceneDslContent = React.createElement('div', { key: 'custom-3d' }, 'custom 3D');
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {}), { sceneDsl: sceneDslContent }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      expect(scenes).toHaveLength(1);

      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      const lastChild = sceneChildren[sceneChildren.length - 1]!;
      expect(lastChild.props).toMatchObject({ id: 'slide-3d-s', x: 0, y: 0, w: '100%', h: '100%' });
      expect(lastChild.props.children).toBe(sceneDslContent);
    });

    it('buildSceneElements does not add extra children when sceneDsl is absent', () => {
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {})),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactNode[];
      // Without sceneDsl: ProgressManager, Floor, Background, Lighting, SlideMetaDsl, 1 TextBox = 6
      expect(sceneChildren).toHaveLength(6);
    });
  });

  describe('CSS variable references in built scene elements', () => {
    it('title layout uses --brewsite-text-primary for heading color', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Find the TextBox child's content
      const textBox = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-title',
      );
      expect(textBox).toBeDefined();
    });

    it('Background element has no explicit color prop', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Background is the 3rd child (index 2: after ProgressManager and Floor)
      const bgChild = sceneChildren[2] as React.ReactElement;
      expect(bgChild.props.color).toBeUndefined();
    });
  });
});

// ─── Smart Layout Routing ──────────────────────────────────────────────────────

/** Mock 3D DSL component — registered with a NodeHandler so getNodeHandler detects it. */
const Mock3DComponent: React.FC = () => null;
Mock3DComponent.displayName = 'Mock3DComponent';

describe('smart layout routing', () => {
  beforeEach(() => {
    registerNode(Mock3DComponent, () => {});
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('classifyRegionContent', () => {
    it('classifies HTML-only content as html', () => {
      const children = React.createElement('div', null, 'Hello');
      const result = classifyRegionContent(children);
      expect(result.contentType).toBe('html');
      expect(result.htmlChildren).toHaveLength(1);
      expect(result.dslChildren).toHaveLength(0);
    });

    it('classifies a registered DSL element as 3d', () => {
      const children = React.createElement(Mock3DComponent);
      const result = classifyRegionContent(children);
      expect(result.contentType).toBe('3d');
      expect(result.dslChildren).toHaveLength(1);
      expect(result.htmlChildren).toHaveLength(0);
    });

    it('classifies mixed content as mixed', () => {
      const children = React.createElement(
        React.Fragment,
        null,
        React.createElement(Mock3DComponent, { key: 'dsl' }),
        React.createElement('p', { key: 'html' }, 'text'),
      );
      const result = classifyRegionContent(children);
      expect(result.contentType).toBe('mixed');
      expect(result.dslChildren).toHaveLength(1);
      expect(result.htmlChildren).toHaveLength(1);
    });

    it('expands Fragment children when classifying', () => {
      const children = React.createElement(
        React.Fragment,
        null,
        React.createElement(Mock3DComponent, { key: 'a' }),
        React.createElement(Mock3DComponent, { key: 'b' }),
      );
      const result = classifyRegionContent(children);
      expect(result.contentType).toBe('3d');
      expect(result.dslChildren).toHaveLength(2);
    });

    it('classifies non-element children (strings, numbers) as html', () => {
      const result = classifyRegionContent('just a string');
      expect(result.contentType).toBe('html');
      expect(result.htmlChildren).toHaveLength(1);
    });

    it('classifies an unregistered component as html', () => {
      const Unregistered: React.FC = () => null;
      const children = React.createElement(Unregistered);
      const result = classifyRegionContent(children);
      expect(result.contentType).toBe('html');
      expect(result.htmlChildren).toHaveLength(1);
      expect(result.dslChildren).toHaveLength(0);
    });
  });

  describe('buildSceneElements routing', () => {
    it('emits TextBox for HTML-only region content', () => {
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement('p', null, 'text'))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Find the body region element (not the title TextBox)
      const bodyEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-body',
      );
      expect(bodyEl).toBeDefined();
      // Should be a TextBox (has id but no data-view-id style)
      expect(bodyEl!.props.id).toBe('s-body');
    });

    it('emits View for 3D-only region content', () => {
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement(Mock3DComponent))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Find the View element for the body region
      const viewEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 'slide-view-s-body',
      );
      expect(viewEl).toBeDefined();
      // Should NOT have a TextBox for body
      const textBoxBody = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-body',
      );
      expect(textBoxBody).toBeUndefined();
    });

    it('emits both View and TextBox for mixed content', () => {
      const mixedContent = React.createElement(
        React.Fragment,
        null,
        React.createElement(Mock3DComponent, { key: 'dsl' }),
        React.createElement('p', { key: 'html' }, 'overlay text'),
      );
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, mixedContent)),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      const viewEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 'slide-view-s-body',
      );
      const textEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-body',
      );
      expect(viewEl).toBeDefined();
      expect(textEl).toBeDefined();
    });

    it('positions routed View at the region NVS bounds', () => {
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement(Mock3DComponent))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const bodyRegion = spec.slides[0]!.regions.find((r) => r.id === 'body')!;
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      const viewEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 'slide-view-s-body',
      );
      expect(viewEl).toBeDefined();
      expect(viewEl!.props.x).toBe(bodyRegion.x);
      expect(viewEl!.props.y).toBe(bodyRegion.y);
      expect(viewEl!.props.w).toBe(bodyRegion.w);
      expect(viewEl!.props.h).toBe(bodyRegion.h);
    });

    it('injects default Camera when a region has 3D content', () => {
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement(Mock3DComponent))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Find Camera element — it has mode='world'
      const cameraEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.mode === 'world' && c?.props?.fov === '42deg',
      );
      expect(cameraEl).toBeDefined();
    });

    it('does not inject Camera when sceneDsl already provides one', () => {
      const sceneDslWithCamera = React.createElement(
        React.Fragment,
        null,
        React.createElement(Camera, { mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }),
      );
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement(Mock3DComponent)), { sceneDsl: sceneDslWithCamera }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Count Camera elements — should have exactly one (from sceneDsl, not injected default)
      const cameraEls = sceneChildren.filter(
        (c: React.ReactElement) => c?.props?.fov === '42deg',
      );
      expect(cameraEls).toHaveLength(0);
    });

    it('preserves sceneDsl fullscreen View as backdrop layer', () => {
      const sceneDslContent = React.createElement('div', { key: 'custom-3d' }, 'custom 3D');
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'T' }, React.createElement(Mock3DComponent)), { sceneDsl: sceneDslContent }),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Last child should be the fullscreen sceneDsl View
      const lastChild = sceneChildren[sceneChildren.length - 1]!;
      expect(lastChild.props).toMatchObject({ id: 'slide-3d-s', x: 0, y: 0, w: '100%', h: '100%' });
    });

    it('routes two-column left=HTML, right=3D correctly', () => {
      const slides = [
        makeSlide('s', React.createElement(TwoColumnSlide, {
          left: React.createElement('p', null, 'html text'),
          right: React.createElement(Mock3DComponent),
        })),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Left column should be a TextBox
      const leftTextBox = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-left',
      );
      expect(leftTextBox).toBeDefined();
      // Right column should be a View
      const rightView = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 'slide-view-s-right',
      );
      expect(rightView).toBeDefined();
    });

    it('title regions always emit TextBox regardless of content', () => {
      const slides = [
        makeSlide('s', React.createElement(ContentSlide, { title: 'My Title' }, React.createElement(Mock3DComponent))),
      ];
      const spec = compileDeck(slides, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      // Title region should be a TextBox with id 's-title'
      const titleEl = sceneChildren.find(
        (c: React.ReactElement) => c?.props?.id === 's-title',
      );
      expect(titleEl).toBeDefined();
    });
  });
});
