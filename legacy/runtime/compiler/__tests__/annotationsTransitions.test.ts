import {describe, expect, it} from 'vitest';
import {annotationsTransitionSpec} from '../transitions/annotationsTransitions';
import {buildContext, expectNumberClose} from './transitionTestUtils';

const baseAnnotation = (overrides: Partial<Parameters<typeof annotationsTransitionSpec.interpolate>[0][number]> = {}) => ({
  id: 'a',
  label: 'a',
  enabled: true,
  style: {
    lineOpacity: 1,
    labelOpacity: 1,
    backgroundOpacity: 1,
    css: { opacity: 1 },
    containerCss: { opacity: 1 },
  },
  ...overrides,
});

describe('annotations transitions', () => {
  it('transitions out annotations by fading opacity', () => {
    const context = buildContext({ tExit: 0.5 });
    const result = annotationsTransitionSpec.exit([
      baseAnnotation(),
    ], context);
    const style = result[0]?.style;
    expectNumberClose(style?.lineOpacity, 0.5);
    expectNumberClose(style?.labelOpacity, 0.5);
    expectNumberClose(style?.css?.opacity as number | undefined, 0.5);
    expectNumberClose(style?.containerCss?.opacity as number | undefined, 0.5);
  });

  it('transitions in annotations by fading opacity', () => {
    const context = buildContext({ tEnter: 0.5 });
    const result = annotationsTransitionSpec.enter([
      baseAnnotation({ id: 'b' }),
    ], context);
    const style = result[0]?.style;
    expectNumberClose(style?.lineOpacity, 0.5);
    expectNumberClose(style?.labelOpacity, 0.5);
    expectNumberClose(style?.css?.opacity as number | undefined, 0.5);
    expectNumberClose(style?.containerCss?.opacity as number | undefined, 0.5);
  });

  it('keeps anchorX stable while fading out', () => {
    const context = buildContext({ tExit: 0.5 });
    const result = annotationsTransitionSpec.exit([
      baseAnnotation({ id: 'anchor-out', style: { anchorX: 'left', labelOpacity: 1 } }),
    ], context);
    expect(result[0]?.style?.anchorX).toBe('left');
  });

  it('uses target anchorX when fading in', () => {
    const context = buildContext({ tEnter: 0.5 });
    const result = annotationsTransitionSpec.enter([
      baseAnnotation({ id: 'anchor-in', style: { anchorX: 'left', labelOpacity: 1 } }),
    ], context);
    expect(result[0]?.style?.anchorX).toBe('left');
  });

  it('preserves css font styles while fading out', () => {
    const context = buildContext({ tExit: 0.5 });
    const result = annotationsTransitionSpec.exit([
      baseAnnotation({ id: 'css-font', style: { css: { fontFamily: 'Space Grotesk', opacity: 1 } } }),
    ], context);
    expect(result[0]?.style?.css?.fontFamily).toBe('Space Grotesk');
    expectNumberClose(result[0]?.style?.css?.opacity as number | undefined, 0.5);
  });

  it('transitions across shared annotations', () => {
    const context = buildContext({ tFull: 0.5 });
    const result = annotationsTransitionSpec.interpolate([
      baseAnnotation({
        id: 'c',
        style: { lineOpacity: 0, labelOpacity: 0, backgroundOpacity: 0, css: { opacity: 0 }, containerCss: { opacity: 0 } },
      }),
    ], [
      baseAnnotation({
        id: 'c',
        style: { lineOpacity: 1, labelOpacity: 1, backgroundOpacity: 1, css: { opacity: 1 }, containerCss: { opacity: 1 } },
      }),
    ], context);
    const style = result[0]?.style;
    expectNumberClose(style?.lineOpacity, 0.5);
    expectNumberClose(style?.labelOpacity, 0.5);
    expectNumberClose(style?.backgroundOpacity, 0.5);
    expectNumberClose(style?.css?.opacity as number | undefined, 0.5);
    expectNumberClose(style?.containerCss?.opacity as number | undefined, 0.5);
  });

  it('uses out/in behavior when ids differ', () => {
    const context = buildContext({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 });
    const result = annotationsTransitionSpec.interpolate([
      baseAnnotation({ id: 'old' }),
    ], [
      baseAnnotation({ id: 'new' }),
    ], context);
    expect(result).toHaveLength(2);
    const out = result.find((item) => item.id === 'old');
    const enter = result.find((item) => item.id === 'new');
    expect(out).toBeTruthy();
    expect(enter).toBeTruthy();
    expectNumberClose(out?.style?.labelOpacity, 0.5);
    expectNumberClose(enter?.style?.labelOpacity, 0.5);
  });

  it('blends visibility across', () => {
    const context = buildContext({ tFull: 0.5 });
    const result = annotationsTransitionSpec.interpolate([
      baseAnnotation({ id: 'vis', visibility: { isVisible: false, minDistance: 0, maxDistance: 10 } }),
    ], [
      baseAnnotation({ id: 'vis', visibility: { isVisible: true, minDistance: 10, maxDistance: 30 } }),
    ], context);
    const visibility = result[0]?.visibility;
    expect(visibility?.isVisible).toBe(true);
    expectNumberClose(visibility?.minDistance, 5);
    expectNumberClose(visibility?.maxDistance, 20);
  });

  it('disables when resolved opacity is near zero', () => {
    const context = buildContext({ tExit: 1 });
    const result = annotationsTransitionSpec.exit([
      baseAnnotation({ enabled: true }),
    ], context);
    expect(result[0]?.enabled).toBe(false);
  });

  it('respects endpoints for across', () => {
    const from = baseAnnotation({ id: 'same', style: { labelOpacity: 0.2, lineOpacity: 0.2, backgroundOpacity: 0.2 } });
    const to = baseAnnotation({ id: 'same', style: { labelOpacity: 0.8, lineOpacity: 0.8, backgroundOpacity: 0.8 } });
    const resultStart = annotationsTransitionSpec.interpolate([from], [to], buildContext({ tFull: 0 }));
    const resultEnd = annotationsTransitionSpec.interpolate([from], [to], buildContext({ tFull: 1 }));
    expectNumberClose(resultStart[0]?.style?.labelOpacity, 0.2);
    expectNumberClose(resultEnd[0]?.style?.labelOpacity, 0.8);
  });

  it('blends label offsets across', () => {
    const from = baseAnnotation({
      id: 'anchor-blend',
      labelAnchor: { labelOffset: [0, 0, 0] },
    });
    const to = baseAnnotation({
      id: 'anchor-blend',
      labelAnchor: { labelOffset: [10, 0, 0] },
    });
    const result = annotationsTransitionSpec.interpolate([from], [to], buildContext({ tFull: 0.5 }));
    expect(result[0]?.labelAnchor && 'labelOffset' in result[0].labelAnchor).toBe(true);
    const offset = result[0]?.labelAnchor && 'labelOffset' in result[0].labelAnchor ? result[0].labelAnchor.labelOffset : undefined;
    expectNumberClose(offset?.[0], 5);
  });
});
