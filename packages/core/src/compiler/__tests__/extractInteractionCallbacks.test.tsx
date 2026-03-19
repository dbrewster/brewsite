// Tests for extractInteractionCallbacks — walks real scene JSX, asserts registry population.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { extractInteractionCallbacks } from '../extractInteractionCallbacks';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import { View } from '../blocks/viewDsl';
import { Scene } from '../sceneDslCompiler';
import { InputController } from '../blocks/inputController';
import type { SceneDefinition, SceneSnapshotContext } from '../sceneTypes';
import type { CarouselSelectEvent } from '../../input/carouselSelectTypes';

/** Helper to build a minimal SceneDefinition from JSX. */
function makeScene(id: string, jsx: React.ReactNode): SceneDefinition {
  return {
    id,
    getFrame: (_ctx: SceneSnapshotContext) => jsx,
  };
}

describe('extractInteractionCallbacks', () => {
  it('returns empty registry when no ViewLayout has onSelect', () => {
    const scenes = [
      makeScene('s1', (
        <ViewLayout id="layout1" kind="carousel">
          <View id="v1" />
        </ViewLayout>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.hasAnySelectHandlers()).toBe(false);
  });

  it('returns registry with handler when ViewLayout has onSelect', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <ViewLayout id="showcase" kind="carousel" onSelect={handler}>
          <View id="v1" />
        </ViewLayout>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.hasAnySelectHandlers()).toBe(true);
    expect(registry.getSelectHandler('showcase')).toBe(handler);
  });

  it('handles multiple ViewLayouts across multiple scenes', () => {
    const h1 = (_e: CarouselSelectEvent): void => {};
    const h2 = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <ViewLayout id="carousel-a" kind="carousel" onSelect={h1}>
          <View id="v1" />
        </ViewLayout>
      )),
      makeScene('s2', (
        <ViewLayout id="carousel-b" kind="carousel" onSelect={h2}>
          <View id="v2" />
        </ViewLayout>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.getSelectHandler('carousel-a')).toBe(h1);
    expect(registry.getSelectHandler('carousel-b')).toBe(h2);
  });

  it('ignores non-carousel ViewLayouts with onSelect', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <ViewLayout id="stack-layout" kind="stack" onSelect={handler}>
          <View id="v1" />
        </ViewLayout>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.hasAnySelectHandlers()).toBe(false);
  });

  it('ignores ViewLayouts without an id', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <ViewLayout kind="carousel" onSelect={handler}>
          <View id="v1" />
        </ViewLayout>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.hasAnySelectHandlers()).toBe(false);
  });

  it('always returns fresh closures — second call reflects new closure', () => {
    const handler1 = (_e: CarouselSelectEvent): void => {};
    const handler2 = (_e: CarouselSelectEvent): void => {};

    const makeScenes = (handler: (e: CarouselSelectEvent) => void): SceneDefinition[] => [
      makeScene('s1', (
        <ViewLayout id="showcase" kind="carousel" onSelect={handler}>
          <View id="v1" />
        </ViewLayout>
      )),
    ];

    const registry1 = extractInteractionCallbacks(makeScenes(handler1));
    const registry2 = extractInteractionCallbacks(makeScenes(handler2));

    expect(registry1.getSelectHandler('showcase')).toBe(handler1);
    expect(registry2.getSelectHandler('showcase')).toBe(handler2);
    // Different registries, different handlers — no stale closure
    expect(registry1.getSelectHandler('showcase')).not.toBe(registry2.getSelectHandler('showcase'));
  });

  it('walks nested JSX to find ViewLayouts', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <React.Fragment>
          <div>
            <ViewLayout id="nested-carousel" kind="carousel" onSelect={handler}>
              <View id="v1" />
            </ViewLayout>
          </div>
        </React.Fragment>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.getSelectHandler('nested-carousel')).toBe(handler);
  });

  it('handles Scene component wrapping — ViewLayout nested inside Scene element', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <Scene id="scene-1">
          <ViewLayout id="wrapped-carousel" kind="carousel" onSelect={handler}>
            <View id="v1" />
          </ViewLayout>
        </Scene>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.getSelectHandler('wrapped-carousel')).toBe(handler);
  });

  it('handles deeply nested ViewLayout alongside InputController siblings', () => {
    const handler = (_e: CarouselSelectEvent): void => {};
    const scenes = [
      makeScene('s1', (
        <Scene id="scene-deep">
          <InputController id="ic" scope="canvas" />
          <React.Fragment>
            <div>
              <ViewLayout id="deep-carousel" kind="carousel" onSelect={handler}>
                <View id="v1" />
                <View id="v2" />
              </ViewLayout>
            </div>
          </React.Fragment>
        </Scene>
      )),
    ];

    const registry = extractInteractionCallbacks(scenes);
    expect(registry.hasAnySelectHandlers()).toBe(true);
    expect(registry.getSelectHandler('deep-carousel')).toBe(handler);
  });
});
