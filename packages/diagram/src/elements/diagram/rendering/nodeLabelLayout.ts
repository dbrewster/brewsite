// Pure label layout arithmetic extracted from NodeRenderer.updateEntry().
// No Three.js, React, or render-layer imports allowed in this file.

/**
 * Computed label layout positions and sizes for a single diagram node.
 * All spatial values are in diagram world units, relative to the node center.
 *
 * The layout guarantees that icon + label + sublabel fit within the content area
 * by applying a uniform scale-down when the total demand exceeds contentH.
 */
export type NodeLabelLayout = {
  /** Y position of the primary label text (group-local). */
  labelY: number;
  /** Y position of the sublabel text (group-local). Undefined when node has no sublabel. */
  sublabelY: number | undefined;
  /** Computed font size for the primary label. */
  labelFontSize: number;
  /** Computed font size for the sublabel. Undefined when node has no sublabel. */
  sublabelFontSize: number | undefined;
  /** Z position for the primary label (front face + epsilon). */
  labelZ: number;
  /** Z position for the sublabel (front face + epsilon). */
  sublabelZ: number;
  /** Y position of the icon center (group-local). Undefined when node has no icon. */
  iconY: number | undefined;
  /** Effective icon scale (may be reduced from input iconScale to fit content). */
  effectiveIconScale: number;
};

/**
 * Computes label layout positions and font sizes for a diagram node.
 *
 * All spatial inputs are in diagram world units (post-NVS conversion).
 * Returns positions in group-local coordinates relative to the node center.
 *
 * The layout uses a fit-to-content strategy: it computes the total vertical
 * demand of all elements (icon + gaps + label + sublabel) and applies a
 * uniform scale-down factor if the demand exceeds contentH. This guarantees
 * that all content fits within the node's visible interior.
 *
 * @param contentW    Width of the usable interior area (shape-masked bounding box).
 * @param contentH    Height of the usable interior area (shape-masked bounding box).
 * @param thickness   Node extrusion depth in world units.
 * @param hasIcon     Whether the node has an icon (affects vertical stacking).
 * @param hasSublabel Whether the node has a sublabel line.
 * @param iconScale   Icon size as a fraction of contentH.
 * @param labelFontSizeBase     Base font size as a fraction of contentH (from theme).
 * @param sublabelFontSizeBase  Base sublabel font size as a fraction of contentH (from theme).
 * @param labelSizeFactor       Multiplier applied to label base size (from theme).
 * @param sublabelSizeFactor    Multiplier applied to sublabel base size (from theme).
 * @param labelPadding          Vertical offset as a fraction of contentH [0–1]. Positive = downward shift.
 */
export function computeNodeLabelLayout(
  contentW: number,
  contentH: number,
  thickness: number,
  hasIcon: boolean,
  hasSublabel: boolean,
  iconScale: number,
  labelFontSizeBase: number,
  sublabelFontSizeBase: number,
  labelSizeFactor: number,
  sublabelSizeFactor: number,
  labelPadding: number = 0,
): NodeLabelLayout {
  // contentW is accepted as a parameter for future use (e.g., text wrapping width),
  // but is not used in the position arithmetic. It is intentionally part of the
  // public signature so callers can pass it without a separate getContentRect call.
  void contentW;

  // Z offset must be large enough to avoid depth-buffer fighting with the box
  // front face at z = 0. A fixed 0.02 is not reliably resolvable in a
  // 24-bit depth buffer at typical camera distances — use a proportional offset
  // (5% of thickness) with a floor of 0.05 to guarantee separation.
  const labelZOffset = Math.max(0.05, thickness * 0.05);

  // Guard: zero-height content area — return zero-size layout.
  if (contentH <= 0) {
    return {
      labelY: 0,
      sublabelY: hasSublabel ? 0 : undefined,
      labelFontSize: 0,
      sublabelFontSize: hasSublabel ? 0 : undefined,
      labelZ: labelZOffset,
      sublabelZ: labelZOffset,
      iconY: hasIcon ? 0 : undefined,
      effectiveIconScale: iconScale,
    };
  }

  // ─── Step 1: Compute ideal (unscaled) element heights as fractions of contentH ─
  // These are the "desired" sizes before any fit-to-content scaling.

  // Vertical padding from edges — 5% top + 5% bottom = 10% total inset
  const INSET = 0.10;

  // Gap fractions (relative to contentH)
  const ICON_TO_LABEL_GAP = 0.06;
  const LABEL_TO_SUBLABEL_GAP = 0.04;

  const iconFraction = hasIcon ? iconScale : 0;
  const labelFraction = labelFontSizeBase * labelSizeFactor * 1.1; // includes line height
  const sublabelFraction = hasSublabel ? sublabelFontSizeBase * sublabelSizeFactor * 1.1 : 0;

  const gapIconLabel = hasIcon ? ICON_TO_LABEL_GAP : 0;
  const gapLabelSublabel = hasSublabel ? LABEL_TO_SUBLABEL_GAP : 0;

  const totalDemand = INSET + iconFraction + gapIconLabel + labelFraction + gapLabelSublabel + sublabelFraction;

  // ─── Step 2: Compute fit scale ──────────────────────────────────────────────
  // If total demand exceeds 1.0 (= contentH), apply a uniform reduction to all
  // element sizes so they fit. The INSET is also scaled, but we use a minimum
  // scale of 0.3 to avoid degenerate micro-layouts.
  const fitScale = totalDemand > 1.0 ? Math.max(0.3, 1.0 / totalDemand) : 1.0;

  // ─── Step 3: Compute effective sizes in world units ─────────────────────────
  const effectiveIconH = iconFraction * fitScale * contentH;
  const effectiveIconScale = iconScale * fitScale;
  const labelFontSize = contentH * labelFontSizeBase * labelSizeFactor * fitScale;
  const sublabelFontSize = hasSublabel
    ? contentH * sublabelFontSizeBase * sublabelSizeFactor * fitScale
    : undefined;
  const labelLine = labelFontSize * 1.1;
  const sublabelLine = sublabelFontSize ? sublabelFontSize * 1.1 : 0;
  const iconLabelGap = gapIconLabel * fitScale * contentH;
  const labelSublabelGap = gapLabelSublabel * fitScale * contentH;
  const insetH = INSET * fitScale * contentH;

  // ─── Step 4: Stack elements top-to-bottom within contentH ───────────────────
  // Content area extends from +contentH/2 (top) to -contentH/2 (bottom).
  // Stack downward from (contentH/2 - inset).
  const stackTop = contentH / 2 - insetH / 2;
  let cursor = stackTop;

  // Icon
  let iconY: number | undefined;
  if (hasIcon) {
    cursor -= effectiveIconH / 2; // icon center
    iconY = cursor;
    cursor -= effectiveIconH / 2; // icon bottom
    cursor -= iconLabelGap;
  }

  // Label
  cursor -= labelLine / 2; // label center
  const labelY = cursor;
  cursor -= labelLine / 2; // label bottom

  // Sublabel
  let sublabelY: number | undefined;
  if (hasSublabel) {
    cursor -= labelSublabelGap;
    cursor -= sublabelLine / 2; // sublabel center
    sublabelY = cursor;
  }

  // ─── Step 5: Apply label padding ────────────────────────────────────────────
  // Positive labelPadding moves labels downward (negative Y direction).
  const paddingOffset = labelPadding * contentH;
  const finalLabelY = labelY - paddingOffset;
  const finalSublabelY = sublabelY !== undefined ? sublabelY - paddingOffset : undefined;
  const finalIconY = iconY !== undefined ? iconY - paddingOffset : undefined;

  return {
    labelY: finalLabelY,
    sublabelY: finalSublabelY,
    labelFontSize,
    sublabelFontSize,
    labelZ: labelZOffset,
    sublabelZ: labelZOffset,
    iconY: finalIconY,
    effectiveIconScale,
  };
}
