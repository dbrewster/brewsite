// YAML frontmatter extraction from MDX source strings.

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Extracts raw YAML frontmatter text from an MDX source string.
 * Returns the YAML block content (without delimiters) or null if no frontmatter is present.
 *
 * This is a lightweight pre-pass used internally. Full YAML parsing is handled
 * by remark-frontmatter + remark-mdx-frontmatter during evaluate().
 */
export function extractFrontmatterBlock(source: string): string | null {
  const match = FRONTMATTER_RE.exec(source);
  return match ? match[1] : null;
}

/**
 * Returns whether the source string begins with a YAML frontmatter block.
 */
export function hasFrontmatter(source: string): boolean {
  return FRONTMATTER_RE.test(source);
}
