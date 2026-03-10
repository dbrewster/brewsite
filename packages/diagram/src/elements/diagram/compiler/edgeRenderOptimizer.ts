import type { DiagramEdgePathCommand, DiagramEdgePathState, DiagramEdgeState } from '../types';

const EPSILON = 1e-6;

const pointsEqual = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON &&
  Math.abs(a[1] - b[1]) < EPSILON &&
  Math.abs(a[2] - b[2]) < EPSILON;

const commandEquals = (
  a: DiagramEdgePathCommand,
  b: DiagramEdgePathCommand,
): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'line' && b.kind === 'line') {
    return pointsEqual(a.from, b.from) && pointsEqual(a.to, b.to);
  }
  if (a.kind === 'cubic' && b.kind === 'cubic') {
    return pointsEqual(a.p0, b.p0) &&
      pointsEqual(a.p1, b.p1) &&
      pointsEqual(a.p2, b.p2) &&
      pointsEqual(a.p3, b.p3);
  }
  return false;
};

const tangentFromCommand = (
  command: DiagramEdgePathCommand | undefined,
  kind: 'start' | 'end',
): readonly [number, number, number] | undefined => {
  if (!command) return undefined;
  if (command.kind === 'line') {
    const start = kind === 'start' ? command.from : command.to;
    const end = kind === 'start' ? command.to : command.from;
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    return [dx / len, dy / len, dz / len];
  }
  const start = kind === 'start' ? command.p0 : command.p3;
  const handle = kind === 'start' ? command.p1 : command.p2;
  const dx = kind === 'start' ? handle[0] - start[0] : start[0] - handle[0];
  const dy = kind === 'start' ? handle[1] - start[1] : start[1] - handle[1];
  const dz = kind === 'start' ? handle[2] - start[2] : start[2] - handle[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return [dx / len, dy / len, dz / len];
};

const commandsToControlPoints = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<readonly [number, number, number]> => {
  const points: Array<readonly [number, number, number]> = [];
  const pushUnique = (point: readonly [number, number, number]): void => {
    const last = points[points.length - 1];
    if (!last || !pointsEqual(last, point)) points.push(point);
  };

  for (const command of commands) {
    if (command.kind === 'line') {
      pushUnique(command.from);
      pushUnique(command.to);
      continue;
    }
    pushUnique(command.p0);
    pushUnique(command.p1);
    pushUnique(command.p2);
    pushUnique(command.p3);
  }

  return points;
};

const canShareRenderedTrunk = (edge: DiagramEdgeState): boolean =>
  edge.routing === 'flow' &&
  edge.path.commands.length >= 2 &&
  edge.arrowStart === 'none' &&
  edge.style === 'solid';

const sameRenderSignature = (a: DiagramEdgeState, b: DiagramEdgeState): boolean =>
  a.color === b.color &&
  a.thickness === b.thickness &&
  a.opacity === b.opacity &&
  a.style === b.style &&
  a.flow === b.flow &&
  a.flowColor === b.flowColor;

function trimEdgePath(
  edge: DiagramEdgeState,
  sharedPrefixCount: number,
): DiagramEdgeState | null {
  const trimmedCommands = edge.path.commands.slice(sharedPrefixCount);
  if (trimmedCommands.length === 0) return null;

  const trimmedPath: DiagramEdgePathState = {
    ...edge.path,
    commands: trimmedCommands,
    startTangent: tangentFromCommand(trimmedCommands[0], 'start') ?? edge.path.startTangent,
  };

  return {
    ...edge,
    path: trimmedPath,
    controlPoints: commandsToControlPoints(trimmedCommands),
    pathDebug: edge.pathDebug
      ? {
        ...edge.pathDebug,
        rankKey: edge.pathDebug.rankKey,
      }
      : edge.pathDebug,
  };
}

export function optimizeSharedFlowTrunks(
  edges: ReadonlyArray<DiagramEdgeState>,
): ReadonlyArray<DiagramEdgeState> {
  const bySource = new Map<string, DiagramEdgeState[]>();
  for (const edge of edges) {
    if (!canShareRenderedTrunk(edge)) continue;
    const bucket = bySource.get(edge.fromId) ?? [];
    bucket.push(edge);
    bySource.set(edge.fromId, bucket);
  }

  const replacements = new Map<string, DiagramEdgeState>();

  bySource.forEach((sourceEdges) => {
    const leaders: DiagramEdgeState[] = [];
    const ordered = [...sourceEdges].sort((a, b) => b.path.commands.length - a.path.commands.length);

    for (const edge of ordered) {
      let bestLeader: DiagramEdgeState | undefined;
      let bestSharedCount = 0;

      for (const leader of leaders) {
        if (!sameRenderSignature(edge, leader)) continue;
        let shared = 0;
        while (
          shared < edge.path.commands.length - 1 &&
          shared < leader.path.commands.length - 1 &&
          commandEquals(edge.path.commands[shared]!, leader.path.commands[shared]!)
        ) {
          shared += 1;
        }
        if (shared > bestSharedCount) {
          bestSharedCount = shared;
          bestLeader = leader;
        }
      }

      if (!bestLeader || bestSharedCount === 0) {
        leaders.push(edge);
        continue;
      }

      const trimmed = trimEdgePath(edge, bestSharedCount);
      if (trimmed) replacements.set(edge.id, trimmed);
    }
  });

  return edges.map((edge) => replacements.get(edge.id) ?? edge);
}
