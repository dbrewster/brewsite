// Pure label layout arithmetic extracted from NodeRenderer.updateEntry().
// No Three.js, React, or render-layer imports allowed in this file.

/**
 * Computed label layout positions and sizes for a single diagram node.
 * All spatial values are in diagram world units.
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
};

/**
 * Computes label layout positions and font sizes for a diagram node.
 *
 * All spatial inputs are in diagram world units (post-NVS conversion).
 * Returns positions in group-local coordinates relative to the node center.
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
): NodeLabelLayout {
  const labelFontSize = contentH * labelFontSizeBase * labelSizeFactor;
  const sublabelFontSize = hasSublabel ? contentH * sublabelFontSizeBase * sublabelSizeFactor : undefined;
  const labelLine = labelFontSize * 1.1;
  const sublabelLine = sublabelFontSize ? sublabelFontSize * 1.1 : 0;
  const lineGap = contentH * 0.06;

  let labelY = 0;
  let sublabelY: number | undefined;

  if (hasIcon) {
    const iconHeight = contentH * iconScale;
    const iconCenterY = contentH * 0.2;
    const iconBottomY = iconCenterY - iconHeight / 2;
    const textTopY = iconBottomY - contentH * 0.08;
    labelY = textTopY - labelLine / 2;
    if (hasSublabel) {
      sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
    }
  } else if (hasSublabel) {
    labelY = contentH * 0.1;
    sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
  }

  // contentW is accepted as a parameter for future use (e.g., text wrapping width),
  // but is not used in the position arithmetic. It is intentionally part of the
  // public signature so callers can pass it without a separate getContentRect call.
  void contentW;

  // Z offset must be large enough to avoid depth-buffer fighting with the box
  // front face at z = 0. A fixed 0.02 is not reliably resolvable in a
  // 24-bit depth buffer at typical camera distances — use a proportional offset
  // (5% of thickness) with a floor of 0.05 to guarantee separation.
  const labelZOffset = Math.max(0.05, thickness * 0.05);

  return {
    labelY,
    sublabelY,
    labelFontSize,
    sublabelFontSize,
    labelZ: labelZOffset,
    sublabelZ: labelZOffset,
  };
}
