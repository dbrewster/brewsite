// Structural type contract for troika-three-text Text objects used by ensureText.

/**
 * Structural interface representing the troika Text object properties
 * that ensureText reads and writes. Typed to match troika's actual property
 * signatures (anchorX/anchorY as optional string | number) so that callers
 * with Text instances satisfy this shape structurally without troika imports.
 */
export type TextWithLayout = {
  text: string;
  color: string | number;
  fontSize: number;
  /**
   * URL to an MSDF-encoded font file for troika-three-text.
   * When set, troika uses this font instead of its built-in default.
   * Corresponds to troika Text object's .font property.
   */
  font?: string;
  anchorX?: string | number;
  anchorY?: string | number;
  textAlign?: string;
  overflowWrap?: string;
  whiteSpace?: string;
  lineHeight?: number;
  maxWidth?: number;
  fillOpacity?: number;
  visible: boolean;
  sync(): void;
  userData: Record<string, unknown>;
  textRenderInfo?: unknown;
};
