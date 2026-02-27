// Raw Lucid API document JSON types.
// These types reflect Lucid's internal document format (same structure as
// document.json inside a .lucid ZIP export). They are intentionally loose
// because Lucid does not publish a formal schema for this format.
// All fields are optional or unknown unless we have confirmed their shape.

/** Top-level document response from GET /api/lucid/:documentId */
export interface LucidDocumentJSON {
  readonly pages?: ReadonlyArray<LucidPageJSON>;
  readonly document?: { readonly pages?: ReadonlyArray<LucidPageJSON> };
  [key: string]: unknown;
}

/** A single page within a Lucid document */
export interface LucidPageJSON {
  readonly id?: string;
  readonly title?: string;
  readonly items?: ReadonlyArray<LucidItemJSON>;
  readonly children?: ReadonlyArray<LucidItemJSON>;
  [key: string]: unknown;
}

/** A single item (shape, line, or group) within a Lucid page */
export interface LucidItemJSON {
  readonly id?: string;
  readonly type?: string;
  readonly shapeType?: string;
  readonly name?: string;
  readonly boundingBox?: LucidBoundingBox;
  readonly bounds?: LucidBoundingBox;
  readonly bbox?: LucidBoundingBox;
  readonly geometry?: { readonly boundingBox?: LucidBoundingBox };
  readonly text?: unknown;
  readonly label?: unknown;
  readonly labels?: ReadonlyArray<unknown>;
  readonly style?: { readonly fill?: string; readonly fillColor?: string };
  readonly parentId?: string;
  readonly groupId?: string;
  readonly endpoint1?: { readonly shapeId?: string };
  readonly endpoint2?: { readonly shapeId?: string };
  readonly start?: { readonly shapeId?: string; readonly shape?: string };
  readonly end?: { readonly shapeId?: string; readonly shape?: string };
  readonly items?: ReadonlyArray<LucidItemJSON>;
  readonly children?: ReadonlyArray<LucidItemJSON>;
  [key: string]: unknown;
}

/** Bounding box as found in various Lucid JSON fields */
export interface LucidBoundingBox {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Options for convertLucidPage() */
export interface LucidConvertOptions {
  /**
   * Uniform scale applied to the compiled DiagramState.
   * Default: 0.01 (1000px Lucid diagram → 10 world units wide)
   */
  readonly scale?: number;
  /**
   * Pivot point. Default: 'top-left'
   * 'top-left' is recommended for Lucid imports.
   */
  readonly pivot?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}
