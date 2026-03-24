// Core hook: compiles MDX source string to a React component with caching.

import { useState, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type { UseMdxCompileResult, CacheEntry, TocEntry, FlatHeading } from './types';
import { remarkToc, nestHeadings } from './toc';

/** Maximum number of entries in the compilation cache (LRU). */
const MAX_CACHE_SIZE = 50;

/** Module-level compilation cache keyed by FNV-1a hash of source string. */
const cache = new Map<number, CacheEntry>();

/**
 * FNV-1a hash for fast, deterministic source string hashing.
 * Not cryptographic — used only for cache keys.
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Evicts the oldest entry from the cache when it exceeds MAX_CACHE_SIZE.
 * Uses insertion order (Map iteration order) as a proxy for LRU.
 */
function evictOldest(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;
  // Map iterates in insertion order — first key is oldest
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
}

/**
 * Parsed import statement: the named bindings and the module specifier.
 */
export interface ParsedImport {
  /** Named imports (e.g., ['SceneEmbed', 'Scene'] from `import { SceneEmbed, Scene } from '...'`). */
  names: string[];
  /** Module specifier (e.g., '@brewsite/core'). */
  from: string;
}

/**
 * Parses `import { Name, ... } from 'specifier'` lines from MDX source.
 * Returns the parsed imports and the source with import/export lines stripped.
 *
 * Import statements are **IDE hints only** — they give IntelliJ/VS Code
 * autocomplete and go-to-definition. At runtime, components come from
 * the pre-registered default component map, not from dynamic imports
 * (bare package specifiers like `@brewsite/core` can't be resolved by
 * the browser's native `import()`).
 *
 * Export statements are stripped since `evaluate()` handles exports internally.
 */
export function parseAndStripImports(source: string): { imports: ParsedImport[]; cleanSource: string } {
  const imports: ParsedImport[] = [];
  const importRegex = /^\s*import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/;

  const cleanLines = source.split('\n').filter((line) => {
    const trimmed = line.trimStart();

    // Strip export lines
    if (trimmed.startsWith('export ') || trimmed.startsWith('export{')) return false;

    // Parse and strip import lines
    const match = importRegex.exec(line);
    if (match) {
      const names = match[1]!.split(',').map((n) => n.trim()).filter(Boolean);
      const from = match[2]!;
      if (names.length > 0) {
        imports.push({ names, from });
      }
      return false;
    }

    // Also strip bare import lines that don't match the pattern (e.g., `import 'foo'`)
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) return false;

    return true;
  });

  return { imports, cleanSource: cleanLines.join('\n') };
}


/** Empty result state used during initial compilation. */
const EMPTY_RESULT: UseMdxCompileResult = {
  Content: null,
  error: null,
  isCompiling: false,
  frontmatter: {},
  toc: [],
};

/**
 * Compiles an MDX string to a React component in the browser.
 * Caches results by source string hash -- recompilation only on source change.
 *
 * Uses `evaluate()` from `@mdx-js/mdx` with remark-gfm, remark-frontmatter,
 * and remark-mdx-frontmatter for full GFM + YAML frontmatter support.
 * Heading TOC is extracted via a custom remark plugin.
 */
export function useMdxCompile(source: string | null): UseMdxCompileResult {
  const [result, setResult] = useState<UseMdxCompileResult>(() => {
    if (source === null) return EMPTY_RESULT;
    const hash = fnv1aHash(source);
    const cached = cache.get(hash);
    if (cached) {
      return {
        Content: cached.Content,
        error: null,
        isCompiling: false,
        frontmatter: cached.frontmatter,
        toc: cached.toc,
      };
    }
    return { ...EMPTY_RESULT, isCompiling: true };
  });

  // Track the current source to avoid stale async results
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (source === null) {
      setResult(EMPTY_RESULT);
      return;
    }

    const hash = fnv1aHash(source);

    // Check cache — return synchronously if hit
    const cached = cache.get(hash);
    if (cached) {
      setResult({
        Content: cached.Content,
        error: null,
        isCompiling: false,
        frontmatter: cached.frontmatter,
        toc: cached.toc,
      });
      return;
    }

    // Mark compiling
    setResult((prev) => (prev.isCompiling ? prev : { ...prev, isCompiling: true, error: null }));

    let cancelled = false;

    // Async compilation
    (async () => {
      try {
        // Dynamic import to respect peer dependency boundary
        const { evaluate } = await import('@mdx-js/mdx');
        const jsxRuntime = await import('react/jsx-runtime');
        const remarkGfm = (await import('remark-gfm')).default;
        const remarkFrontmatter = (await import('remark-frontmatter')).default;
        const remarkMdxFrontmatter = (await import('remark-mdx-frontmatter')).default;

        // Build a file data container to capture TOC from remark plugin
        const tocPlugin = remarkToc();
        let capturedTocFlat: FlatHeading[] = [];
        const tocCapture = () => (tree: Parameters<ReturnType<typeof remarkToc>>[0], file: Parameters<ReturnType<typeof remarkToc>>[1]) => {
          tocPlugin(tree, file);
          capturedTocFlat = (file.data.toc as FlatHeading[]) ?? [];
        };

        // Strip import/export statements — they serve as IDE hints only.
        // Components are provided via the default map + consumer's components prop.
        const { cleanSource } = parseAndStripImports(source);

        const mod = await evaluate(cleanSource, {
          ...jsxRuntime,
          remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter, tocCapture],
          development: false,
        });

        if (cancelled || sourceRef.current !== source) return;

        const Content = mod.default as ComponentType<{ components?: Record<string, ComponentType> }>;
        const frontmatter = (mod.frontmatter as Record<string, unknown>) ?? {};
        const toc: TocEntry[] = nestHeadings(capturedTocFlat);

        // Cache the result
        const entry: CacheEntry = {
          Content,
          frontmatter,
          toc,
          timestamp: Date.now(),
        };
        cache.set(hash, entry);
        evictOldest();

        setResult({
          Content,
          error: null,
          isCompiling: false,
          frontmatter,
          toc,
        });
      } catch (err) {
        if (cancelled || sourceRef.current !== source) return;
        setResult({
          Content: null,
          error: err instanceof Error ? err : new Error(String(err)),
          isCompiling: false,
          frontmatter: {},
          toc: [],
                });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return result;
}

/**
 * Clears the module-level compilation cache.
 * Exposed for testing and manual cache invalidation.
 */
export function clearMdxCache(): void {
  cache.clear();
}

/**
 * Returns the current cache size for diagnostic purposes.
 */
export function getMdxCacheSize(): number {
  return cache.size;
}
