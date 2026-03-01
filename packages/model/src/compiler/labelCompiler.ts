import type { LabelResolved } from '../labels/types';
export type LabelCompileContext = { sceneProgress: number };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpVec3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => ([
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]);

const resolveOpacity = (label: LabelResolved, key: 'labelOpacity' | 'lineOpacity'): number =>
  (label.style?.[key] ?? 1) as number;

const withOpacity = (label: LabelResolved, labelOpacity: number, lineOpacity: number): LabelResolved => ({
  ...label,
  style: {
    ...(label.style ?? {}),
    labelOpacity,
    lineOpacity,
  },
});

const interpolateLabel = (
  from: LabelResolved,
  to: LabelResolved,
  t: number,
): LabelResolved => {
  const fromOffset = from.labelOffset ?? [0, 0, 0];
  const toOffset = to.labelOffset ?? [0, 0, 0];
  const labelOffset = lerpVec3(fromOffset, toOffset, t);
  const fromLabelOpacity = resolveOpacity(from, 'labelOpacity');
  const toLabelOpacity = resolveOpacity(to, 'labelOpacity');
  const fromLineOpacity = resolveOpacity(from, 'lineOpacity');
  const toLineOpacity = resolveOpacity(to, 'lineOpacity');
  const labelOpacity = lerp(fromLabelOpacity, toLabelOpacity, t);
  const lineOpacity = lerp(fromLineOpacity, toLineOpacity, t);
  const useTo = t >= 0.5;
  const base = useTo ? to : from;
  return withOpacity(
    {
      ...base,
      labelOffset,
    },
    labelOpacity,
    lineOpacity,
  );
};

/**
 * Compiles label definitions for a transition block.
 */
export const compileLabels = (
  fromLabels: LabelResolved[] | undefined,
  toLabels: LabelResolved[] | undefined,
  context: LabelCompileContext,
): LabelResolved[] => {
  const t = context.sceneProgress;
  const from = (fromLabels ?? []).filter((l) => l.enabled !== false);
  const to = (toLabels ?? []).filter((l) => l.enabled !== false);
  if (!from.length && !to.length) return [];

  const fromMap = new Map(from.map((l) => [l.id, l]));
  const toMap = new Map(to.map((l) => [l.id, l]));
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);
  const result: LabelResolved[] = [];

  for (const id of ids) {
    const fromLabel = fromMap.get(id);
    const toLabel = toMap.get(id);
    if (fromLabel && toLabel) {
      const blended = interpolateLabel(fromLabel, toLabel, t);
      if ((blended.style?.labelOpacity ?? 1) > 0 || (blended.style?.lineOpacity ?? 1) > 0) {
        result.push(blended);
      }
      continue;
    }
    if (fromLabel) {
      const fade = 1 - t;
      const labelOpacity = resolveOpacity(fromLabel, 'labelOpacity') * fade;
      const lineOpacity = resolveOpacity(fromLabel, 'lineOpacity') * fade;
      if (labelOpacity <= 0 && lineOpacity <= 0) continue;
      result.push(withOpacity(fromLabel, labelOpacity, lineOpacity));
      continue;
    }
    if (toLabel) {
      const fade = t;
      const labelOpacity = resolveOpacity(toLabel, 'labelOpacity') * fade;
      const lineOpacity = resolveOpacity(toLabel, 'lineOpacity') * fade;
      if (labelOpacity <= 0 && lineOpacity <= 0) continue;
      result.push(withOpacity(toLabel, labelOpacity, lineOpacity));
    }
  }
  return result;
};
