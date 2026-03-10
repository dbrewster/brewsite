import type {
  DiagramEdgePathCommand,
  DiagramEdgePathDebug,
  DiagramEdgePathState,
} from '../types';

type Vec3 = readonly [number, number, number];

export type FlowRouteKind = DiagramEdgePathDebug['routeKind'];

export type FlowPathBuildInput = {
  readonly anchorStart: Vec3;
  readonly anchorEnd: Vec3;
  readonly startStub: Vec3;
  readonly endStub: Vec3;
  readonly waypoints: ReadonlyArray<Vec3>;
  readonly startTangent: Vec3;
  readonly endTangent: Vec3;
  readonly turnRadius: number;
  readonly usedUnderpass: boolean;
  readonly punctures: DiagramEdgePathState['punctures'];
};

const EPSILON = 1e-6;
const ARC_KAPPA = 0.5522847498307936;

const vecEqual = (a: Vec3, b: Vec3): boolean =>
  Math.abs(a[0] - b[0]) < EPSILON &&
  Math.abs(a[1] - b[1]) < EPSILON &&
  Math.abs(a[2] - b[2]) < EPSILON;

const subVec = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];

const lengthVec = (v: Vec3): number => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);

const normalizeVec = (v: Vec3): Vec3 => {
  const len = lengthVec(v);
  if (len < EPSILON) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
};

const dotVec = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const isAxisAligned = (v: Vec3): boolean =>
  Math.abs(v[0]) < EPSILON || Math.abs(v[1]) < EPSILON;

const pushLine = (
  commands: DiagramEdgePathCommand[],
  from: Vec3,
  to: Vec3,
): void => {
  if (vecEqual(from, to)) return;
  commands.push({ kind: 'line', from, to });
};

const buildPolyline = (
  points: ReadonlyArray<Vec3>,
): DiagramEdgePathCommand[] => {
  const commands: DiagramEdgePathCommand[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    pushLine(commands, from, to);
  }
  return commands;
};

export function commandsToControlPoints(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3> {
  const points: Vec3[] = [];

  const pushUnique = (point: Vec3): void => {
    const last = points[points.length - 1];
    if (!last || !vecEqual(last, point)) points.push(point);
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
}

export function buildPathStateFromCommands(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
  startTangent: Vec3,
  endTangent: Vec3,
  usedUnderpass = false,
  punctures: DiagramEdgePathState['punctures'] = [],
): DiagramEdgePathState {
  return {
    commands,
    startTangent,
    endTangent,
    usedUnderpass,
    punctures,
  };
}

export function buildLegacyEdgePath(
  controlPoints: ReadonlyArray<Vec3>,
  startTangent: Vec3,
  endTangent: Vec3,
): DiagramEdgePathState {
  const commands = controlPoints.length === 4
    ? [{
      kind: 'cubic' as const,
      p0: controlPoints[0]!,
      p1: controlPoints[1]!,
      p2: controlPoints[2]!,
      p3: controlPoints[3]!,
    }]
    : buildPolyline(controlPoints);

  return buildPathStateFromCommands(commands, startTangent, endTangent);
}

export function buildFlowPathState(input: FlowPathBuildInput): DiagramEdgePathState {
  const rawPoints = [
    input.anchorStart,
    input.startStub,
    ...input.waypoints,
    input.endStub,
    input.anchorEnd,
  ].filter((point, index, all): point is Vec3 => {
    if (!point) return false;
    const prev = index > 0 ? all[index - 1] : undefined;
    return !prev || !vecEqual(point, prev as Vec3);
  });

  if (rawPoints.length < 2) {
    return buildPathStateFromCommands([], input.startTangent, input.endTangent, input.usedUnderpass, input.punctures);
  }

  const rebuilt: DiagramEdgePathCommand[] = [];
  let currentCursor = rawPoints[0]!;

  for (let i = 1; i < rawPoints.length - 1; i += 1) {
    const prev = rawPoints[i - 1]!;
    const current = rawPoints[i]!;
    const next = rawPoints[i + 1]!;
    const incoming = subVec(current, prev);
    const outgoing = subVec(next, current);
    const incomingLength = lengthVec(incoming);
    const outgoingLength = lengthVec(outgoing);
    if (incomingLength < EPSILON || outgoingLength < EPSILON) {
      pushLine(rebuilt, currentCursor, current);
      currentCursor = current;
      continue;
    }

    const incomingDir = normalizeVec(incoming);
    const outgoingDir = normalizeVec(outgoing);
    const turnDot = clamp(dotVec(scaleVec(incomingDir, -1), outgoingDir), -1, 1);
    const turnAngle = Math.acos(turnDot);
    if (turnAngle < 0.08 || Math.abs(Math.PI - turnAngle) < 0.08) {
      pushLine(rebuilt, currentCursor, current);
      currentCursor = current;
      continue;
    }

    if (!isAxisAligned(incoming) || !isAxisAligned(outgoing)) {
      pushLine(rebuilt, currentCursor, current);
      currentCursor = current;
      continue;
    }

    const isTerminalCorner = i === 1 || i === rawPoints.length - 2;
    const radiusCap = isTerminalCorner
      ? Math.min(incomingLength * 0.42, outgoingLength * 0.42)
      : Math.min(incomingLength * 0.5, outgoingLength * 0.5);
    const radius = Math.min(input.turnRadius, radiusCap);
    if (
      radius < EPSILON
    ) {
      pushLine(rebuilt, currentCursor, current);
      currentCursor = current;
      continue;
    }

    const startInset = addVec(current, scaleVec(incomingDir, -radius));
    const endInset = addVec(current, scaleVec(outgoingDir, radius));
    const handleLength = radius * ARC_KAPPA * clamp(turnAngle / (Math.PI / 2), 0.55, 1.25);

    pushLine(rebuilt, currentCursor, startInset);
    rebuilt.push({
      kind: 'cubic',
      p0: startInset,
      p1: addVec(startInset, scaleVec(incomingDir, handleLength)),
      p2: addVec(endInset, scaleVec(outgoingDir, -handleLength)),
      p3: endInset,
    });
    currentCursor = endInset;
  }

  pushLine(rebuilt, currentCursor, rawPoints[rawPoints.length - 1]!);

  return buildPathStateFromCommands(
    rebuilt,
    input.startTangent,
    input.endTangent,
    input.usedUnderpass,
    input.punctures,
  );
}
