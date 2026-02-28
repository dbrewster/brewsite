import type { DiagramThemeLayoutConfig, LayoutDSL, LayoutPadding } from '../types';

// Resolved layout types — all fields required (no optionals).
// Produced by resolveEffectiveLayout(); consumed by layout algorithms.

export interface ResolvedBaseLayout {
  readonly spacing: readonly [number, number];
  readonly margin: readonly [number, number];
  readonly groupPadding: readonly [number, number, number, number];
  readonly titleGap: number;
  readonly alignment: 'left' | 'center' | 'right' | 'fill';
  readonly disconnected: 'next-to' | 'after';
}

export interface ResolvedGridLayout extends ResolvedBaseLayout {
  readonly kind: 'grid';
  readonly columns: number | 'auto';
}

export interface ResolvedHierarchicalLayout extends ResolvedBaseLayout {
  readonly kind: 'hierarchical';
  readonly direction: 'top-down' | 'left-right';
}

export interface ResolvedManualLayout {
  readonly kind: 'manual';
  readonly groupPadding: readonly [number, number, number, number];
  readonly titleGap: number;
}

export type ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout;

export interface ResolvedLayoutDefaults {
  readonly root: ResolvedLayout;
  readonly grid: ResolvedGridLayout;
  readonly hierarchical: ResolvedHierarchicalLayout;
  readonly manual: ResolvedManualLayout;
}

/**
 * Normalizes LayoutPadding to [top, right, bottom, left] tuple.
 * Follows CSS shorthand semantics:
 *   number        → [n, n, n, n]
 *   [v, h]        → [v, h, v, h]
 *   [t, h, b]     → [t, h, b, h]
 *   [t, r, b, l]  → [t, r, b, l]
 */
export function normalizeGroupPadding(
  p: LayoutPadding,
): readonly [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [p[0], p[1], p[2], p[3]];
}

/**
 * Normalizes margin to [horizontal, vertical] tuple.
 * number    → [n, n]
 * [h, v]    → [h, v]
 */
export function normalizeMargin(
  m: number | readonly [number, number],
): readonly [number, number] {
  return typeof m === 'number' ? [m, m] : [m[0], m[1]];
}

const DEFAULT_GROUP_PADDING_NORMALIZED: readonly [number, number, number, number] = [1.5, 1.5, 1.5, 1.5];
const DEFAULT_TITLE_GAP = 1;
const DEFAULT_GRID_SPACING: readonly [number, number] = [2, 2];
const DEFAULT_HIERARCHICAL_SPACING: readonly [number, number] = [1.5, 1.5];
const DEFAULT_MARGIN: readonly [number, number] = [0, 0];

export const DEFAULT_RESOLVED_GRID: ResolvedGridLayout = {
  kind: 'grid',
  columns: 'auto',
  spacing: DEFAULT_GRID_SPACING,
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
  alignment: 'left',
  disconnected: 'next-to',
};

export const DEFAULT_RESOLVED_HIERARCHICAL: ResolvedHierarchicalLayout = {
  kind: 'hierarchical',
  direction: 'top-down',
  spacing: DEFAULT_HIERARCHICAL_SPACING,
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
  alignment: 'center',
  disconnected: 'next-to',
};

export const DEFAULT_RESOLVED_MANUAL: ResolvedManualLayout = {
  kind: 'manual',
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
};

const BASE_RESOLVED_LAYOUT_DEFAULTS: ResolvedLayoutDefaults = {
  root: DEFAULT_RESOLVED_GRID,
  grid: DEFAULT_RESOLVED_GRID,
  hierarchical: DEFAULT_RESOLVED_HIERARCHICAL,
  manual: DEFAULT_RESOLVED_MANUAL,
};

export function resolveThemeLayoutDefaults(
  themeLayout: DiagramThemeLayoutConfig | undefined,
): ResolvedLayoutDefaults {
  const gridDefaults: ResolvedGridLayout = {
    ...DEFAULT_RESOLVED_GRID,
    ...(themeLayout?.grid?.columns !== undefined && { columns: themeLayout.grid.columns }),
    ...(themeLayout?.grid?.spacing !== undefined && { spacing: themeLayout.grid.spacing }),
    ...(themeLayout?.grid?.margin !== undefined && { margin: normalizeMargin(themeLayout.grid.margin) }),
    ...(themeLayout?.grid?.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(themeLayout.grid.groupPadding) }),
    ...(themeLayout?.grid?.titleGap !== undefined && { titleGap: themeLayout.grid.titleGap }),
    ...(themeLayout?.grid?.alignment !== undefined && { alignment: themeLayout.grid.alignment }),
    ...(themeLayout?.grid?.disconnected !== undefined && { disconnected: themeLayout.grid.disconnected }),
  };

  const hierarchicalDefaults: ResolvedHierarchicalLayout = {
    ...DEFAULT_RESOLVED_HIERARCHICAL,
    ...(themeLayout?.hierarchical?.direction !== undefined && { direction: themeLayout.hierarchical.direction }),
    ...(themeLayout?.hierarchical?.spacing !== undefined && { spacing: themeLayout.hierarchical.spacing }),
    ...(themeLayout?.hierarchical?.margin !== undefined && { margin: normalizeMargin(themeLayout.hierarchical.margin) }),
    ...(themeLayout?.hierarchical?.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(themeLayout.hierarchical.groupPadding) }),
    ...(themeLayout?.hierarchical?.titleGap !== undefined && { titleGap: themeLayout.hierarchical.titleGap }),
    ...(themeLayout?.hierarchical?.alignment !== undefined && { alignment: themeLayout.hierarchical.alignment }),
    ...(themeLayout?.hierarchical?.disconnected !== undefined && { disconnected: themeLayout.hierarchical.disconnected }),
  };

  const manualDefaults: ResolvedManualLayout = {
    ...DEFAULT_RESOLVED_MANUAL,
    ...(themeLayout?.manual?.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(themeLayout.manual.groupPadding) }),
    ...(themeLayout?.manual?.titleGap !== undefined && { titleGap: themeLayout.manual.titleGap }),
  };

  const root: ResolvedLayout = themeLayout?.defaultKind === 'hierarchical'
    ? hierarchicalDefaults
    : themeLayout?.defaultKind === 'manual'
      ? manualDefaults
      : gridDefaults;

  return {
    root,
    grid: gridDefaults,
    hierarchical: hierarchicalDefaults,
    manual: manualDefaults,
  };
}

/**
 * Applies LayoutDSL props over a kind-specific default, producing a ResolvedLayout.
 * Used when no parent exists or when the parent is a different kind.
 */
export function applyLayoutDefaults(own: LayoutDSL): ResolvedLayout {
  return applyLayoutDefaultsWithTheme(own, BASE_RESOLVED_LAYOUT_DEFAULTS);
}

export function applyLayoutDefaultsWithTheme(
  own: LayoutDSL,
  defaults: ResolvedLayoutDefaults,
): ResolvedLayout {
  if (own.kind === 'manual') {
    return {
      ...defaults.manual,
      groupPadding: own.groupPadding !== undefined
        ? normalizeGroupPadding(own.groupPadding)
        : defaults.manual.groupPadding,
      titleGap: own.titleGap ?? defaults.manual.titleGap,
    };
  }
  const base = own.kind === 'grid' ? defaults.grid : defaults.hierarchical;
  return {
    ...base,
    ...(own.spacing !== undefined && { spacing: own.spacing }),
    ...(own.margin !== undefined && { margin: normalizeMargin(own.margin) }),
    ...(own.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(own.groupPadding) }),
    ...(own.titleGap !== undefined && { titleGap: own.titleGap }),
    ...(own.alignment !== undefined && { alignment: own.alignment }),
    ...(own.disconnected !== undefined && { disconnected: own.disconnected }),
    ...(own.kind === 'grid' && own.columns !== undefined && { columns: own.columns }),
    ...(own.kind === 'hierarchical' && own.direction !== undefined && { direction: own.direction }),
  } as ResolvedLayout;
}

/**
 * Merges a same-kind child LayoutDSL onto a resolved parent.
 * Child props win over parent; undefined props fall through to parent.
 * Only called when own.kind === parent.kind.
 */
export function mergeResolvedLayouts(
  parent: ResolvedLayout,
  child: LayoutDSL,
): ResolvedLayout {
  const result = { ...parent } as Record<string, unknown>;
  if (child.kind === 'manual') {
    if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
    if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
    return result as unknown as ResolvedLayout;
  }
  if (child.spacing !== undefined) result['spacing'] = child.spacing;
  if (child.margin !== undefined) result['margin'] = normalizeMargin(child.margin);
  if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
  if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
  if (child.alignment !== undefined) result['alignment'] = child.alignment;
  if (child.disconnected !== undefined) result['disconnected'] = child.disconnected;
  if (child.kind === 'grid' && child.columns !== undefined) result['columns'] = child.columns;
  if (child.kind === 'hierarchical' && child.direction !== undefined) result['direction'] = child.direction;
  return result as unknown as ResolvedLayout;
}

/**
 * Resolves the effective layout for a single node in the cascade chain.
 *
 * Rules:
 *   own absent           → inherit parent as-is (or default grid if no parent)
 *   own.kind !== parent  → apply own over kind-specific defaults (no inheritance)
 *   own.kind === parent  → merge: parent provides defaults, own overrides specified props
 */
export function resolveEffectiveLayout(
  own: LayoutDSL | undefined,
  parent: ResolvedLayout | undefined,
  defaults: ResolvedLayoutDefaults = BASE_RESOLVED_LAYOUT_DEFAULTS,
): ResolvedLayout {
  const base = parent ?? defaults.root;
  if (!own) return base;
  if (!parent || own.kind !== parent.kind) return applyLayoutDefaultsWithTheme(own, defaults);
  return mergeResolvedLayouts(base, own);
}

/**
 * Builds a map of groupId → ResolvedLayout for every group in the tree,
 * cascading from the root diagram layout through the parent chain.
 *
 * Groups with no parentId cascade directly from rootLayout.
 * Nested groups cascade from their parent group's resolved layout.
 */
export function resolveGroupLayouts(
  groups: ReadonlyArray<{ id: string; parentId?: string; layout?: LayoutDSL }>,
  rootLayout: ResolvedLayout,
  defaults: ResolvedLayoutDefaults = BASE_RESOLVED_LAYOUT_DEFAULTS,
): Map<string, ResolvedLayout> {
  const result = new Map<string, ResolvedLayout>();
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const resolve = (groupId: string): ResolvedLayout => {
    const cached = result.get(groupId);
    if (cached) return cached;
    const group = groupById.get(groupId);
    if (!group) return rootLayout;
    const parentLayout = group.parentId ? resolve(group.parentId) : rootLayout;
    const resolved = resolveEffectiveLayout(group.layout, parentLayout, defaults);
    result.set(groupId, resolved);
    return resolved;
  };

  groups.forEach((g) => resolve(g.id));
  return result;
}
