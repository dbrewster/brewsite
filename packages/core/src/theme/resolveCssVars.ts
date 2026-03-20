// Deep-walks an object and resolves CSS variable references to their computed values.

/** Regex to match `var(--name)` or `var(--name, fallback)`. */
const CSS_VAR_RE = /^var\(--([^,)]+)(?:,\s*(.+))?\)$/;

/**
 * Deep-walks a theme object (SceneTheme, DiagramTheme, ChartTheme, or any plain object)
 * and resolves any string value matching `var(--...)` to its computed CSS value
 * via `getComputedStyle(document.documentElement).getPropertyValue(...)`.
 *
 * Returns a new object with all CSS variable references replaced by their resolved values.
 * Non-string values and strings that don't start with `var(--` are passed through unchanged.
 *
 * @throws if a CSS variable cannot be resolved (returns empty string from getPropertyValue)
 *         and no fallback is provided.
 */
export function resolveCssVars<T extends Record<string, unknown>>(obj: T): T {
  const style = getComputedStyle(document.documentElement);
  return deepResolve(obj, style) as T;
}

function deepResolve(value: unknown, style: CSSStyleDeclaration): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return resolveString(value, style);
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepResolve(item, style));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = deepResolve((value as Record<string, unknown>)[key], style);
    }
    return result;
  }

  return value;
}

function resolveString(value: string, style: CSSStyleDeclaration): string {
  const match = CSS_VAR_RE.exec(value);
  if (!match) return value;

  const varName = match[1].trim();
  const fallback = match[2]?.trim();
  const resolved = style.getPropertyValue(`--${varName}`).trim();

  if (resolved !== '') return resolved;
  if (fallback !== undefined) return fallback;

  throw new Error(`CSS variable "--${varName}" is not defined`);
}
