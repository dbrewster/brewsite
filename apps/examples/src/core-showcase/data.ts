// Chart data for the Core Showcase chart scenes.
// Scene 10 (chart-a): Framework Adoption — initial dataset.
// Scene 11 (chart-b): Same keyField, different values — triggers datum-level morphing.
//
// DataInput = ReadonlyArray<DataRow> where DataRow = Readonly<Record<string, unknown>>.
// Using const satisfies to keep a typed shape while satisfying the DataInput constraint.

import type { DataInput } from '@brewsite/charts';

export const frameworkDataA: DataInput = [
  { framework: 'React', adoption: 87, satisfaction: 78 },
  { framework: 'Vue', adoption: 52, satisfaction: 84 },
  { framework: 'Angular', adoption: 48, satisfaction: 61 },
  { framework: 'Svelte', adoption: 31, satisfaction: 90 },
  { framework: 'Solid', adoption: 14, satisfaction: 88 },
];

export const frameworkDataB: DataInput = [
  { framework: 'React', adoption: 89, satisfaction: 74 },
  { framework: 'Vue', adoption: 49, satisfaction: 82 },
  { framework: 'Angular', adoption: 44, satisfaction: 58 },
  { framework: 'Svelte', adoption: 38, satisfaction: 92 },
  { framework: 'Solid', adoption: 22, satisfaction: 91 },
];
