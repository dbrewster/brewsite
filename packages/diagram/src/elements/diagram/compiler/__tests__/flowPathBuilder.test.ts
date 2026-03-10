import { describe, expect, it } from 'vitest';
import {
  buildFlowPathState,
  commandsToControlPoints,
} from '../flowPathBuilder';

describe('buildFlowPathState', () => {
  it('keeps a straight route line-only while preserving anchor and stub geometry', () => {
    const path = buildFlowPathState({
      anchorStart: [0, 0, 0],
      startStub: [1, 0, 0],
      waypoints: [],
      endStub: [4, 0, 0],
      anchorEnd: [5, 0, 0],
      startTangent: [1, 0, 0],
      endTangent: [-1, 0, 0],
      turnRadius: 0.5,
      usedUnderpass: false,
      punctures: [],
    });

    expect(path.commands.every((command) => command.kind === 'line')).toBe(true);
    expect(commandsToControlPoints(path.commands)[0]).toEqual([0, 0, 0]);
    expect(commandsToControlPoints(path.commands).at(-1)).toEqual([5, 0, 0]);
  });

  it('inserts cubic fillets for interior turns while keeping terminal stubs exact', () => {
    const path = buildFlowPathState({
      anchorStart: [0, 0, 0],
      startStub: [1, 0, 0],
      waypoints: [[1, 2, 0], [4, 2, 0]],
      endStub: [5, 2, 0],
      anchorEnd: [6, 2, 0],
      startTangent: [1, 0, 0],
      endTangent: [-1, 0, 0],
      turnRadius: 0.4,
      usedUnderpass: false,
      punctures: [],
    });

    expect(path.commands.some((command) => command.kind === 'cubic')).toBe(true);
    const points = commandsToControlPoints(path.commands);
    expect(points[0]).toEqual([0, 0, 0]);
    expect(points.at(-1)).toEqual([6, 2, 0]);
  });

  it('preserves underpass metadata and z-deviation in commands', () => {
    const path = buildFlowPathState({
      anchorStart: [0, 0, 0],
      startStub: [1, 0, 0],
      waypoints: [[2, 0, -0.1], [4, 0, -0.1]],
      endStub: [5, 0, 0],
      anchorEnd: [6, 0, 0],
      startTangent: [1, 0, 0],
      endTangent: [-1, 0, 0],
      turnRadius: 0.25,
      usedUnderpass: true,
      punctures: [],
    });

    const points = commandsToControlPoints(path.commands);
    expect(path.usedUnderpass).toBe(true);
    expect(points.some((point) => point[2] < 0)).toBe(true);
  });

  it('uses turnRadius on terminal flow elbows instead of leaving them permanently sharp', () => {
    const sharp = buildFlowPathState({
      anchorStart: [0, 0, 0],
      startStub: [1, 0, 0],
      waypoints: [],
      endStub: [1, 3, 0],
      anchorEnd: [1, 4, 0],
      startTangent: [1, 0, 0],
      endTangent: [0, 1, 0],
      turnRadius: 0,
      usedUnderpass: false,
      punctures: [],
    });

    const rounded = buildFlowPathState({
      anchorStart: [0, 0, 0],
      startStub: [1, 0, 0],
      waypoints: [],
      endStub: [1, 3, 0],
      anchorEnd: [1, 4, 0],
      startTangent: [1, 0, 0],
      endTangent: [0, 1, 0],
      turnRadius: 0.45,
      usedUnderpass: false,
      punctures: [],
    });

    expect(sharp.commands.every((command) => command.kind === 'line')).toBe(true);
    expect(rounded.commands.some((command) => command.kind === 'cubic')).toBe(true);
  });
});
