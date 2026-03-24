// Heading TOC extractor: remark plugin, nesting utility, and slugify function.

import type { FlatHeading, TocEntry } from './types';

/**
 * Converts a heading text string to a URL-safe slug.
 * Lowercases, replaces whitespace with hyphens, strips non-alphanumeric characters
 * (except hyphens), and collapses consecutive hyphens.
 */
export function slugify(text: string): string {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** Minimal recursive node shape for mdast text extraction. */
interface MdastTextNode {
  value?: string;
  children?: MdastTextNode[];
}

/**
 * Extracts plain text from an mdast node tree by recursively
 * concatenating all text and inline-code values.
 */
function mdastToString(node: MdastTextNode): string {
  if (typeof node.value === 'string') return node.value;
  if (Array.isArray(node.children)) {
    return node.children.map(mdastToString).join('');
  }
  return '';
}

/**
 * Remark plugin that collects heading nodes from the AST and stores
 * a flat heading list on `file.data.toc` as `FlatHeading[]`.
 *
 * The collected headings are later nested via `nestHeadings()`.
 */
export function remarkToc(): (tree: { children: MdastNode[] }, file: { data: Record<string, unknown> }) => void {
  return (tree, file) => {
    const headings: FlatHeading[] = [];
    visitHeadings(tree, (node) => {
      const text = mdastToString(node);
      const id = slugify(text);
      headings.push({ depth: node.depth, text, id });
    });
    file.data.toc = headings;
  };
}

/** Minimal node shape from the mdast AST. */
interface MdastNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdastNode[];
}

/** Type guard: checks if a node is a heading with a depth property. */
function isHeadingNode(node: MdastNode): node is MdastNode & { depth: number } {
  return node.type === 'heading' && typeof node.depth === 'number';
}

/** Walks an mdast tree and invokes the callback for each heading node. */
function visitHeadings(
  tree: { children?: MdastNode[] },
  callback: (node: MdastNode & { depth: number }) => void,
): void {
  if (!tree.children) return;
  for (const child of tree.children) {
    if (isHeadingNode(child)) {
      callback(child);
    }
    if (child.children) {
      visitHeadings(child, callback);
    }
  }
}

/**
 * Converts a flat list of headings into a nested TocEntry tree.
 *
 * h1 headings are excluded (treated as the page title, not a TOC entry).
 * h2s become top-level entries. h3s nest under the preceding h2, h4s under
 * the preceding h3, and so on.
 */
export function nestHeadings(flat: FlatHeading[]): TocEntry[] {
  const root: TocEntry[] = [];
  const stack: TocEntry[] = [];

  for (const heading of flat) {
    // Skip h1 — page title, not a TOC entry
    if (heading.depth <= 1) continue;

    const entry: TocEntry = {
      depth: heading.depth,
      text: heading.text,
      id: heading.id,
      children: [],
    };

    // Pop stack until we find a parent with a shallower depth
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].children.push(entry);
    }

    stack.push(entry);
  }

  return root;
}
