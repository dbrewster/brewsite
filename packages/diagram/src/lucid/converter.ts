// Pure converter: Lucid document page JSON → DiagramDSL.
// Browser-compatible port of scripts/import-lucid.mjs.
// No Node.js APIs. No ZIP. No HJSON. No side effects.

import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL } from '../elements/diagram/types';
import type {
  LucidDocumentJSON,
  LucidPageJSON,
  LucidItemJSON,
  LucidBoundingBox,
  LucidConvertOptions,
} from './types';

// Mirrors LUCID_SHAPE_MAP from scripts/import-lucid.mjs — kept in sync manually.
// If new shape mappings are added to that script, add them here too.
const LUCID_SHAPE_MAP: Record<string, string> = {
  rectangleShape:              'flow:rect',
  roundedRectangleShape:       'flow:rounded',
  processShape:                'flow:rounded',
  decisionShape:               'flow:diamond',
  databaseShape:               'flow:cylinder',
  ovalShape:                   'flow:oval',
  cloudShape:                  'flow:cloud',
  actorShape:                  'flow:actor',
  documentShape:               'flow:document',
  parallelogramShape:          'flow:parallelogram',
  'aws3.EC2':                  'aws:ec2',
  'aws3.S3':                   'aws:s3',
  'aws3.RDSInstance':          'aws:rds',
  'aws3.Lambda':               'aws:lambda',
  'aws3.ApplicationLoadBalancing': 'aws:alb',
  'aws3.CloudFront':           'aws:cloudfront',
  'aws3.VPC':                  'aws:vpc',
  'aws3.ECSContainer':         'aws:ecs',
  'aws3.SQSQueue':             'aws:sqs',
  'aws3.SNSTopic':             'aws:sns',
};

/** Pixels per diagram unit. Must match PIXEL_TO_UNIT in scripts/import-lucid.mjs. */
const PIXEL_TO_UNIT = 100;

// ─── Tree traversal ───────────────────────────────────────────────────────────

/** Recursively collects all objects from a Lucid page tree into a flat array. */
function collectItems(node: unknown, out: LucidItemJSON[] = []): LucidItemJSON[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectItems(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  out.push(obj as LucidItemJSON);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') collectItems(val, out);
  }
  return out;
}

// ─── Field extraction helpers ─────────────────────────────────────────────────

/** Extracts a plain string from the many label formats Lucid uses across versions. */
function extractText(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return extractText(obj[0]);
  if (typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o['text'] === 'string') return o['text'];
    if (Array.isArray(o['text'])) return extractText(o['text'][0]);
    if (typeof o['value'] === 'string') return o['value'];
    if (typeof o['label'] === 'string') return o['label'];
    if (Array.isArray(o['labels'])) return extractText(o['labels'][0]);
  }
  return '';
}

/** Resolves the bounding box from whichever field name Lucid uses in this document version. */
function getBoundingBox(item: LucidItemJSON): LucidBoundingBox | null {
  return item.boundingBox
    ?? item.bounds
    ?? item.bbox
    ?? item.geometry?.boundingBox
    ?? null;
}

function isLine(item: LucidItemJSON): boolean {
  return typeof item.type === 'string' && item.type.toLowerCase().includes('line');
}

function isGroup(item: LucidItemJSON): boolean {
  return typeof item.type === 'string' && item.type.toLowerCase().includes('group');
}

function isShape(item: LucidItemJSON): boolean {
  return getBoundingBox(item) !== null
    && typeof item.id === 'string'
    && !isLine(item)
    && !isGroup(item);
}

// ─── Class-based format (newer Lucid export) ──────────────────────────────────
// Newer .lucid files store shapes in page.items.shapes[] with a `class` field
// and no bounding box data. Positions are stored server-side and not exported.
// We map the class names to shape variants and use hierarchical auto-layout.

/** Class names used in newer Lucid exports → BrewSite shape variants. */
const LUCID_CLASS_MAP: Record<string, string> = {
  ProcessBlock:        'flow:rounded',
  RectangleBlock:      'flow:rect',
  DiamondBlock:        'flow:diamond',
  CircleBlock:         'flow:oval',
  CylinderBlock:       'flow:cylinder',
  CloudBlock:          'flow:cloud',
  DocumentBlock:       'flow:document',
  ParallelogramBlock:  'flow:parallelogram',
  UserImage2Block:     'flow:actor',
  UsersAzure2021:      'flow:actor',
  // AWS
  EC2Block:            'aws:ec2',
  S3Block:             'aws:s3',
  LambdaBlock:         'aws:lambda',
  CloudFrontBlock:     'aws:cloudfront',
};

interface ClassBasedShape {
  id: string;
  class: string;
  textAreas?: Array<{ label?: string; text?: string }>;
  [key: string]: unknown;
}

interface ClassBasedLine {
  id: string;
  endpoint1?: { connectedTo?: string; style?: string };
  endpoint2?: { connectedTo?: string; style?: string };
  textAreas?: Array<{ text?: string }>;
  [key: string]: unknown;
}

interface ClassBasedItems {
  shapes?: ClassBasedShape[];
  lines?: ClassBasedLine[];
  groups?: unknown[];
  [key: string]: unknown;
}

/** Returns true if this page uses the newer class-based Lucid format (no bounding boxes). */
function isClassBasedFormat(page: LucidPageJSON): boolean {
  const items = (page as Record<string, unknown>)['items'] as ClassBasedItems | undefined;
  if (!Array.isArray(items?.shapes) || items.shapes.length === 0) return false;
  return typeof items.shapes[0]?.['class'] === 'string' && !getBoundingBox(items.shapes[0] as unknown as LucidItemJSON);
}

/**
 * Converts a class-based Lucid page (newer export format, no positions) to DiagramDSL.
 * Uses hierarchical auto-layout since spatial coordinates are not available.
 */
function convertClassBasedPage(
  page: LucidPageJSON,
  diagramId: string,
  opts: LucidConvertOptions,
): DiagramDSL {
  const items = (page as Record<string, unknown>)['items'] as ClassBasedItems;
  const shapes = items?.shapes ?? [];
  const lines  = items?.lines  ?? [];

  // ── Build a set of all shape IDs for edge validation ─────────────────────
  const shapeIds = new Set(shapes.map((s) => s.id));

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodes: DiagramNodeDSL[] = shapes
    .filter((s) => s.id && s.class)
    .map((shape): DiagramNodeDSL => {
      const id = String(shape.id);
      const cls = shape.class ?? 'ProcessBlock';
      const mapped = LUCID_CLASS_MAP[cls];
      if (!mapped) {
        console.warn(`[lucid/converter] Unknown class "${cls}" (id: ${id}), falling back to flow:rounded`);
      }

      // Extract label — prefer the 'Text' area, fall back to any non-empty area
      const textArea = shape.textAreas?.find((t) => t.label === 'Text') ?? shape.textAreas?.[0];
      const label = textArea?.text?.trim() || id;

      return {
        id,
        label,
        shape: (mapped ?? 'flow:rounded') as DiagramNodeDSL['shape'],
        // No positions — hierarchical layout will place them
      };
    });

  // ── Edges ─────────────────────────────────────────────────────────────────
  const edges: DiagramEdgeDSL[] = lines
    .map((line): DiagramEdgeDSL | null => {
      const from = line.endpoint1?.connectedTo;
      const to   = line.endpoint2?.connectedTo;
      if (!from || !to) return null;
      // Only include edges between known shapes (skip unresolved refs)
      if (!shapeIds.has(from) || !shapeIds.has(to)) return null;
      return { from, to };
    })
    .filter((e): e is DiagramEdgeDSL => e !== null);

  return {
    id: diagramId,
    layout: 'hierarchical',
    layoutSpacing: [2.5, 2.0],
    nodes,
    edges,
    groups: [],
    scale: opts.scale ?? 1,
    pivot: opts.pivot ?? 'center',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Selects a page from a Lucid document JSON response.
 * Returns null if the document has no pages or the index is out of range.
 */
export function selectLucidPage(
  doc: LucidDocumentJSON,
  pageIndex: number,
): LucidPageJSON | null {
  const pages = doc.pages ?? doc.document?.pages ?? [];
  if (!Array.isArray(pages) || pages.length === 0) return null;
  if (pageIndex < 0 || pageIndex >= pages.length) return null;
  return pages[pageIndex] as LucidPageJSON;
}

/**
 * Converts a single Lucid document page to a DiagramDSL.
 * Pure function — no side effects, no async, no I/O.
 *
 * Coordinate convention:
 *   Lucid x, y are pixels from the top-left of the page.
 *   Divide by PIXEL_TO_UNIT (100) to convert to diagram units.
 *   Y is negated because BrewSite's Y axis points up; Lucid's points down.
 *   Node position is the center of its bounding box.
 *
 * Shape mapping:
 *   Known Lucid shape types are mapped via LUCID_SHAPE_MAP.
 *   Unknown types fall back to 'flow:rect' with a console.warn.
 *
 * @param page      - A single page from the Lucid document JSON
 * @param diagramId - The id to assign to the resulting DiagramDSL
 * @param opts      - Conversion options (scale, pivot)
 */
export function convertLucidPage(
  page: LucidPageJSON,
  diagramId: string,
  opts: LucidConvertOptions = {},
): DiagramDSL {
  // Auto-detect newer class-based format (no bounding boxes, items.shapes[].class)
  if (isClassBasedFormat(page)) {
    return convertClassBasedPage(page, diagramId, opts);
  }

  const scale = opts.scale ?? 0.01;
  const pivot = opts.pivot ?? 'top-left';

  const allItems = collectItems(page);
  const shapes = allItems.filter(isShape);
  const lines  = allItems.filter(isLine);
  const groups = allItems.filter(isGroup);

  // ── Nodes ────────────────────────────────────────────────────────────────

  const nodes: DiagramNodeDSL[] = shapes.map((shape): DiagramNodeDSL => {
    const box     = getBoundingBox(shape)!;
    const pixelW  = box.w ?? box.width  ?? 80;
    const pixelH  = box.h ?? box.height ?? 60;
    const centerX = (box.x ?? 0) + pixelW / 2;
    const centerY = (box.y ?? 0) + pixelH / 2;

    const id      = String(shape.id ?? `node-${Math.random().toString(36).slice(2, 8)}`);
    const rawType = shape.type ?? shape.shapeType ?? shape.name ?? 'rectangleShape';
    const mapped  = LUCID_SHAPE_MAP[rawType];

    if (!mapped) {
      console.warn(
        `[lucid/converter] Unknown shape type "${rawType}" (id: ${id}), falling back to flow:rect`,
      );
    }

    const label = extractText(shape.text ?? shape.label ?? shape) || id;
    const color = shape.style?.fill ?? shape.style?.fillColor ?? undefined;
    const groupId = shape.parentId ?? shape.groupId
      ? String(shape.parentId ?? shape.groupId)
      : undefined;

    return {
      id,
      label,
      shape: (mapped ?? 'flow:rect') as DiagramNodeDSL['shape'],
      // Positions are in diagram units (pixels ÷ PIXEL_TO_UNIT).
      // The DiagramDSL `scale` prop converts these to world units at compile time.
      position: [centerX / PIXEL_TO_UNIT, -(centerY / PIXEL_TO_UNIT), 0],
      size:     [pixelW  / PIXEL_TO_UNIT,   pixelH  / PIXEL_TO_UNIT],
      ...(color    !== undefined ? { color }   : {}),
      ...(groupId  !== undefined ? { groupId } : {}),
    };
  });

  // ── Edges ────────────────────────────────────────────────────────────────

  const edges: DiagramEdgeDSL[] = lines
    .map((line): DiagramEdgeDSL | null => {
      const ep1 = line.endpoint1;
      const ep2 = line.endpoint2;
      const start = line.start as Record<string, unknown> | undefined;
      const end   = line.end   as Record<string, unknown> | undefined;

      const from =
        ep1?.shapeId
        ?? (start?.['shapeId'] as string | undefined)
        ?? (start?.['shape']   as string | undefined)
        ?? null;

      const to =
        ep2?.shapeId
        ?? (end?.['shapeId'] as string | undefined)
        ?? (end?.['shape']   as string | undefined)
        ?? null;

      if (!from || !to) return null;
      return { from: String(from), to: String(to) };
    })
    .filter((e): e is DiagramEdgeDSL => e !== null);

  // ── Groups ───────────────────────────────────────────────────────────────

  // Build a map of groupId → member node IDs from the nodes we already have
  const groupNodeMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.groupId) continue;
    const list = groupNodeMap.get(node.groupId) ?? [];
    list.push(node.id);
    groupNodeMap.set(node.groupId, list);
  }

  const compiledGroups: DiagramGroupDSL[] = groups
    .map((group): DiagramGroupDSL => {
      const id    = String(group.id ?? `group-${Math.random().toString(36).slice(2, 8)}`);
      const label = extractText(group.text ?? group.label ?? group) || id;
      return { id, label, nodeIds: groupNodeMap.get(id) ?? [] };
    })
    .filter((g) => g.nodeIds.length > 0);

  return {
    id: diagramId,
    layout: 'manual',
    layoutSpacing: [2, 2],
    nodes,
    edges,
    groups: compiledGroups,
    scale,
    pivot,
  };
}
