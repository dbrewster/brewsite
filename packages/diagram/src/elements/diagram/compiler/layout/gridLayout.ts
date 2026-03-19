// Column-grid layout algorithm for diagram nodes.

import type { DiagramNodeDSL, DiagramEdgeDSL } from '../../types';
import type { ResolvedGridLayout } from '../layoutResolver';

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const ensurePair = (
  pair: readonly [number, number],
  fallback: readonly [number, number],
): readonly [number, number] => ([
  isFiniteNumber(pair[0]) ? pair[0] : fallback[0],
  isFiniteNumber(pair[1]) ? pair[1] : fallback[1],
]);

/**
 * Assigns [x, y, z] positions for a grid layout.
 * Nodes with explicit positions are preserved. Remaining nodes are placed left-to-right
 * in rows. Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveGridLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedGridLayout,
  defaultNodeSize: readonly [number, number],
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const missing: DiagramNodeDSL[] = [];

  nodes.forEach((node) => {
    if (node.position) {
      positions.set(node.id, node.position);
    } else {
      missing.push(node);
    }
  });

  if (missing.length === 0) {
    return positions;
  }

  const { spacing, margin: rawMargin, columns: rawColumns, alignment, disconnected } = layout;
  const safeSpacing = ensurePair(spacing, [0.06, 0.06]);
  const safeMargin = ensurePair(rawMargin, [0, 0]);
  const resolvedCols = rawColumns === 'auto' || rawColumns === undefined ? 4 : rawColumns;
  const cols = !Number.isFinite(resolvedCols) || resolvedCols <= 0 ? 4 : resolvedCols;
  const margin = safeMargin;

  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => { connectedNodeIds.add(e.from); connectedNodeIds.add(e.to); });
  const orderedMissing = disconnected === 'after'
    ? [
        ...missing.filter((n) => connectedNodeIds.has(n.id)),
        ...missing.filter((n) => !connectedNodeIds.has(n.id)),
      ]
    : missing;

  const rowCount = Math.ceil(orderedMissing.length / cols);
  const nodeSizeById = new Map<string, readonly [number, number]>(
    orderedMissing.map((node) => [
      node.id,
      (node.size ?? defaultNodeSize) as readonly [number, number],
    ]),
  );
  const effectiveSizeById = new Map<string, readonly [number, number]>(
    orderedMissing.map((node) => {
      const [w, h] = nodeSizeById.get(node.id) ?? defaultNodeSize;
      return [node.id, [w + 2 * margin[0], h + 2 * margin[1]] as const];
    }),
  );

  const rowHeights: number[] = [];
  const rowWidths: number[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const rowNodes = orderedMissing.slice(r * cols, (r + 1) * cols);
    const rowEffectiveWidths = rowNodes.map((n) => (effectiveSizeById.get(n.id) ?? defaultNodeSize)[0]);
    const rowEffectiveHeights = rowNodes.map((n) => (effectiveSizeById.get(n.id) ?? defaultNodeSize)[1]);
    const rowWidth = rowEffectiveWidths.reduce((sum, w) => sum + w, 0) +
      Math.max(0, rowNodes.length - 1) * safeSpacing[0];
    const rowHeight = rowEffectiveHeights.length > 0 ? Math.max(...rowEffectiveHeights) : 0;
    rowWidths.push(rowWidth);
    rowHeights.push(rowHeight);
  }

  const widestRowWidth = rowWidths.length > 0 ? Math.max(...rowWidths) : 0;
  const rowCenterY: number[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    if (r === 0) {
      rowCenterY.push(0);
      continue;
    }
    const prevY = rowCenterY[r - 1] ?? 0;
    const prevHeight = rowHeights[r - 1] ?? 0;
    const currentHeight = rowHeights[r] ?? 0;
    rowCenterY.push(prevY - (prevHeight / 2 + safeSpacing[1] + currentHeight / 2));
  }

  orderedMissing.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const rowNodes = orderedMissing.slice(row * cols, (row + 1) * cols);
    const rowWidth = rowWidths[row] ?? 0;

    let rowOffset = 0;
    if (alignment === 'center') {
      rowOffset = (widestRowWidth - rowWidth) / 2;
    } else if (alignment === 'right') {
      rowOffset = widestRowWidth - rowWidth;
    } else if (alignment === 'fill' && rowNodes.length > 1) {
      const fillStep = widestRowWidth / (rowNodes.length - 1);
      const x = col * fillStep + rowOffset;
      const y = rowCenterY[row] ?? 0;
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
      return;
    }
    if (alignment === 'fill' && rowNodes.length === 1) {
      rowOffset = (widestRowWidth - rowWidth) / 2;
      const x = rowOffset + rowWidth / 2;
      const y = rowCenterY[row] ?? 0;
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
      return;
    }

    let x = rowOffset;
    for (let i = 0; i <= col; i += 1) {
      const currentNode = rowNodes[i];
      if (!currentNode) break;
      const currentSize = effectiveSizeById.get(currentNode.id) ?? defaultNodeSize;
      if (i === 0) {
        x += currentSize[0] / 2;
      } else {
        const prevNode = rowNodes[i - 1]!;
        const prevSize = effectiveSizeById.get(prevNode.id) ?? defaultNodeSize;
        x += prevSize[0] / 2 + safeSpacing[0] + currentSize[0] / 2;
      }
    }
    const y = rowCenterY[row] ?? 0;
    const z = node.position?.[2] ?? 0;
    positions.set(node.id, [x, y, z]);
  });

  return positions;
}
