// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Scene } from '../../compiler/sceneDslCompiler';
import { SceneRegistrationContext } from '../../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../../compiler/SceneRegistrationContext';
import { Lighting } from '../../elements/lighting';

describe('Scene registration', () => {
  it('registers scene id into context', () => {
    const registered = new Map<string, ReactElement>();
    const value: SceneRegistrationValue = {
      register: (id, element) => registered.set(id, element),
      unregister: (id) => registered.delete(id),
    };

    render(
      <SceneRegistrationContext.Provider value={value}>
        <Scene id="test-scene">
          <Lighting />
        </Scene>
      </SceneRegistrationContext.Provider>,
    );

    expect(registered.has('test-scene')).toBe(true);
  });

  it('unregisters scene on unmount', () => {
    const registered = new Map<string, ReactElement>();
    const value: SceneRegistrationValue = {
      register: (id, element) => registered.set(id, element),
      unregister: (id) => registered.delete(id),
    };

    const view = render(
      <SceneRegistrationContext.Provider value={value}>
        <Scene id="test-scene" />
      </SceneRegistrationContext.Provider>,
    );

    expect(registered.has('test-scene')).toBe(true);
    view.unmount();
    expect(registered.has('test-scene')).toBe(false);
  });

  it('updates registration when props change', () => {
    const registered = new Map<string, ReactElement>();
    const value: SceneRegistrationValue = {
      register: (id, element) => registered.set(id, element),
      unregister: (id) => registered.delete(id),
    };

    const { rerender } = render(
      <SceneRegistrationContext.Provider value={value}>
        <Scene id="dynamic" meta={{ tone: 'warm' }} />
      </SceneRegistrationContext.Provider>,
    );

    const before = registered.get('dynamic');
    rerender(
      <SceneRegistrationContext.Provider value={value}>
        <Scene id="dynamic" meta={{ tone: 'cool' }} />
      </SceneRegistrationContext.Provider>,
    );

    const after = registered.get('dynamic');
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });

  it('registers multiple scenes in source order', () => {
    const order: string[] = [];
    const value: SceneRegistrationValue = {
      register: (id) => {
        if (!order.includes(id)) order.push(id);
      },
      unregister: () => {},
    };

    render(
      <SceneRegistrationContext.Provider value={value}>
        <Scene id="a" />
        <Scene id="b" />
        <Scene id="c" />
      </SceneRegistrationContext.Provider>,
    );

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('registers wrapped Scene components', () => {
    const registered = new Map<string, ReactElement>();
    const value: SceneRegistrationValue = {
      register: (id, element) => registered.set(id, element),
      unregister: (id) => registered.delete(id),
    };
    const MyScene = () => <Scene id="wrapped"><Lighting /></Scene>;

    render(
      <SceneRegistrationContext.Provider value={value}>
        <MyScene />
      </SceneRegistrationContext.Provider>,
    );

    expect(registered.has('wrapped')).toBe(true);
  });
});
