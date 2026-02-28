import { describe, expect, it } from 'vitest';
import React from 'react';
import { Scene } from '../../compiler/sceneDslCompiler';
import { serializeJsx } from '../serializeJsx';

const Foo = (_props: { a: number; b: number }) => null;
const Node = (_props: { label: string; x: number }) => null;

describe('serializeJsx', () => {
  it('serializes primitives', () => {
    expect(serializeJsx(42)).toBe('42');
    expect(serializeJsx('hello')).toBe('"hello"');
    expect(serializeJsx(true)).toBe('true');
    expect(serializeJsx(null)).toBe('null');
  });

  it('serializes React elements including component name and props', () => {
    const value = serializeJsx(<Foo a={1} b={2} />);
    expect(value).toContain('Foo');
    expect(value).toContain('a:1');
    expect(value).toContain('b:2');
  });

  it('is stable regardless of prop order', () => {
    const a = serializeJsx(<Foo a={1} b={2} />);
    const b = serializeJsx(<Foo b={2} a={1} />);
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    expect(serializeJsx(<Node label="a" x={1} />)).not.toBe(serializeJsx(<Node label="a" x={2} />));
  });

  it('includes keys in the serialized output', () => {
    expect(serializeJsx(<Scene id="same" key="a" />)).not.toBe(serializeJsx(<Scene id="same" key="b" />));
  });

  it('captures nested child changes', () => {
    const a = serializeJsx(
      <Scene id="s" key="s">
        <Node label="first" x={1} />
      </Scene>,
    );
    const b = serializeJsx(
      <Scene id="s" key="s">
        <Node label="first" x={2} />
      </Scene>,
    );
    expect(a).not.toBe(b);
  });

  it('caps depth at 15 without throwing', () => {
    let deep: React.ReactNode = <span />;
    for (let i = 0; i < 20; i += 1) {
      deep = <div>{deep}</div>;
    }
    expect(() => serializeJsx(deep)).not.toThrow();
    expect(serializeJsx(deep)).toContain('[deep]');
  });

  it('handles wide trees deterministically', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => (
      <Node key={`n${i}`} label={`Node ${i}`} x={i * 100} />
    ));
    const scene1 = <Scene id="big" key="big">{nodes}</Scene>;
    const scene2 = <Scene id="big" key="big">{nodes}</Scene>;
    expect(serializeJsx(scene1)).toBe(serializeJsx(scene2));

    const nodesModified = [
      ...nodes.slice(0, 49),
      <Node key="n49" label="CHANGED" x={49 * 100} />,
    ];
    const scene3 = <Scene id="big" key="big">{nodesModified}</Scene>;
    expect(serializeJsx(scene3)).not.toBe(serializeJsx(scene1));
  });
});
