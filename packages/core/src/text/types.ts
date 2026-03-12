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
  /**
   * SDF glyph size for troika-three-text atlas tile rendering (pixels per glyph).
   * Smaller values fit more unique glyphs into the shared atlas but increase
   * atlas pressure. Troika default is 64. Corresponds to troika Text.sdfGlyphSize.
   */
  sdfGlyphSize?: number;
  sync(): void;
  /**
   * Disposes the troika Text instance, releasing its SDF atlas slot, internal
   * ShaderMaterial, and generated geometry. Must be called instead of manual
   * `.geometry.dispose()` — troika manages shared atlas resources that only
   * `.dispose()` can properly release.
   */
  dispose(): void;
  userData: Record<string, unknown>;
  textRenderInfo?: unknown;
};
