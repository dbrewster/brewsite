// Tests for compileDeck() — DeckSpec production from <Slide> element trees.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { compileDeck, buildSceneElements } from '../deckCompiler';
import { compileDeckTheme } from '../themeCompiler';
import { Slide, TitleLayout, TitleBodyLayout, TwoColumnLayout, FullBleedLayout, BlankLayout, BulletList, NumberedList } from '../../dsl';

// Helper: produce ReactElement<Record<string, unknown>> as expected by compileDeck
function makeSlide(key: string, children?: React.ReactNode, props?: Record<string, unknown>): React.ReactElement<Record<string, unknown>> {
  return React.createElement(Slide, { key, ...props } as React.ComponentProps<typeof Slide>, children) as React.ReactElement<Record<string, unknown>>;
}

const theme = compileDeckTheme();

describe('compileDeck', () => {
  describe('slide count and keys', () => {
    it('produces DeckSpec with correct slide count', () => {
      const slides = [
        makeSlide('intro', React.createElement(TitleLayout, { title: 'Intro' })),
        makeSlide('main', React.createElement(TitleBodyLayout, { title: 'Main' })),
        makeSlide('outro', React.createElement(TitleLayout, { title: 'Outro' })),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides).toHaveLength(3);
    });

    it('preserves slide keys', () => {
      const slides = [
        makeSlide('first', React.createElement(TitleLayout, { title: 'A' })),
        makeSlide('second', React.createElement(TitleBodyLayout, { title: 'B' })),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      // React may prefix keys with ".$" in some cases; compileSlide strips this prefix
      expect(spec.slides[0]!.key).toMatch(/first/);
      expect(spec.slides[1]!.key).toMatch(/second/);
    });

    it('stores the resolved theme', () => {
      const slides = [makeSlide('s1', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.theme).toBe(theme);
    });

    it('stores the deck-level transition', () => {
      const slides = [makeSlide('s1', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'none');
      expect(spec.transition).toBe('none');
    });
  });

  describe('layout detection', () => {
    it('detects title layout', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('title');
    });

    it('detects title-body layout', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('title-body');
    });

    it('detects two-column layout', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { left: null, right: null }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('two-column');
    });

    it('detects full-bleed layout', () => {
      const slides = [makeSlide('s', React.createElement(FullBleedLayout, {}))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('full-bleed');
    });

    it('detects blank layout for BlankLayout', () => {
      const slides = [makeSlide('s', React.createElement(BlankLayout, {}))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('blank');
    });

    it('falls back to blank layout when no layout child', () => {
      const slides = [makeSlide('s')];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.layout).toBe('blank');
    });
  });

  describe('regions', () => {
    it('title layout produces 1 region', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(1);
    });

    it('title-body layout produces 2 regions (title + body)', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(2);
      expect(spec.slides[0]!.regions.find((r) => r.id === 'title')).toBeDefined();
      expect(spec.slides[0]!.regions.find((r) => r.id === 'body')).toBeDefined();
    });

    it('two-column layout with title produces 3 regions', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { title: 'T', left: null, right: null }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(3);
    });

    it('two-column layout without title produces 2 regions', () => {
      const slides = [makeSlide('s', React.createElement(TwoColumnLayout, { left: null, right: null }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(2);
    });

    it('blank layout produces 1 full-size body region', () => {
      const slides = [makeSlide('s', React.createElement(BlankLayout, {}))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.regions).toHaveLength(1);
      expect(spec.slides[0]!.regions[0]!.id).toBe('body');
    });
  });

  describe('scrollUnits', () => {
    it('title layout defaults to 100 scrollUnits', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.scrollUnits).toBe(100);
    });

    it('body layouts default to 400 scrollUnits', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.scrollUnits).toBe(400);
    });

    it('scrollUnits prop overrides default', () => {
      const slides = [makeSlide('s', React.createElement(TitleBodyLayout, { title: 'T' }), { scrollUnits: 200 })];
      const spec = compileDeck(slides, theme, 'dissolve');
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
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.hasAnimatedList).toBe(false);
      expect(spec.slides[0]!.totalBullets).toBe(0);
    });

    it('hasAnimatedList is true when BulletList has animateEntrance=true', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TitleBodyLayout, { title: 'T' },
            React.createElement(BulletList, { items: ['A', 'B', 'C'], animateEntrance: true }))),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.hasAnimatedList).toBe(true);
      expect(spec.slides[0]!.totalBullets).toBe(3);
    });

    it('counts bullets from NumberedList with animateEntrance=true', () => {
      const slides = [
        makeSlide('s',
          React.createElement(TitleBodyLayout, { title: 'T' },
            React.createElement(NumberedList, { items: ['1', '2'], animateEntrance: true }))),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
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
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.totalBullets).toBe(5);
    });
  });

  describe('slide-level transition override', () => {
    it('inherits deck-level transition when slide has no override', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'none');
      expect(spec.slides[0]!.transition).toBe('none');
    });

    it('uses slide-level transition when provided', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'T' }), { transition: 'dissolve' }),
      ];
      const spec = compileDeck(slides, theme, 'none');
      expect(spec.slides[0]!.transition).toBe('dissolve');
    });
  });

  describe('notes and title metadata', () => {
    it('extracts notes from slide props', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'T' }), { notes: 'My note' }),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.notes).toBe('My note');
    });

    it('title prop on slide overrides layout title', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'Layout Title' }), { title: 'Slide Title' }),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.title).toBe('Slide Title');
    });

    it('uses layout title when no slide-level title prop', () => {
      const slides = [
        makeSlide('s', React.createElement(TitleLayout, { title: 'Layout Title' })),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.title).toBe('Layout Title');
    });
  });

  describe('sceneDsl', () => {
    it('sceneDsl is undefined when not provided', () => {
      const slides = [makeSlide('s', React.createElement(TitleLayout, { title: 'T' }))];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.sceneDsl).toBeUndefined();
    });

    it('carries sceneDsl through when provided', () => {
      const sceneDslContent = React.createElement('div', null, 'custom 3D content');
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {}), { sceneDsl: sceneDslContent }),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      expect(spec.slides[0]!.sceneDsl).toBe(sceneDslContent);
    });

    it('buildSceneElements wraps sceneDsl in a fullscreen View', () => {
      const sceneDslContent = React.createElement('div', { key: 'custom-3d' }, 'custom 3D');
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {}), { sceneDsl: sceneDslContent }),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      expect(scenes).toHaveLength(1);

      // The Scene element's children should include the sceneDsl wrapped in a <View>.
      // Scene children are: ProgressManager, Floor, Background, Lighting, SlideMetaDsl, ...TextBoxes, View(sceneDsl)
      const sceneChildren = scenes[0]!.props.children as React.ReactElement[];
      const lastChild = sceneChildren[sceneChildren.length - 1]!;
      // The wrapper is a <View> with fullscreen bounds
      expect(lastChild.props).toMatchObject({ id: 'slide-3d-s', x: 0, y: 0, w: 1, h: 1 });
      // The sceneDsl content is inside the View
      expect(lastChild.props.children).toBe(sceneDslContent);
    });

    it('buildSceneElements does not add extra children when sceneDsl is absent', () => {
      const slides = [
        makeSlide('s', React.createElement(BlankLayout, {})),
      ];
      const spec = compileDeck(slides, theme, 'dissolve');
      const scenes = buildSceneElements(slides, spec);
      const sceneChildren = scenes[0]!.props.children as React.ReactNode[];
      // Without sceneDsl: ProgressManager, Floor, Background, Lighting, SlideMetaDsl, 1 TextBox = 6
      expect(sceneChildren).toHaveLength(6);
    });
  });
});
