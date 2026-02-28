// Serializes a JSX element tree to a stable string for scene content-change detection.

import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Converts a JSX subtree to a stable string for cache key computation and
 * recompilation detection in ScenePlayer. Called once per scene per parent render.
 *
 * Design constraints:
 * - Object keys are sorted so prop order does not affect the output.
 * - React elements serialize as: TypeName[key](sortedProps){children}
 * - Functions serialize to displayName or name. Anonymous functions produce '[fn]'.
 * - Depth is capped at 15 to prevent stack overflow on pathological inputs.
 * - This is NOT a general-purpose serializer. Its sole purpose is detecting
 *   meaningful scene prop changes between parent renders.
 *
 * NOTE: Function-valued props serialize to displayName/name, or '[fn]' for anonymous
 * functions. DSL scene components must NOT accept function-valued props that affect
 * compiled output — if a DSL component needs dynamic behavior, the value should come
 * from external state (useSceneRuntime, useState, etc.) that produces a concrete prop
 * change, not a function reference change. A callback defined inline (e.g.
 * `onFoo={() => doThing()}`) always produces '[fn]' and will never trigger recompilation
 * even if the callback body changes.
 */
export const serializeJsx = (value: unknown, depth = 0): string => {
  if (depth > 15) return '[deep]';
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') {
    return (value as { displayName?: string; name?: string }).displayName
      ?? (value as { name?: string }).name
      ?? '[fn]';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serializeJsx(v, depth + 1)).join(',')}]`;
  }
  if (isValidElement(value)) {
    const el = value as ReactElement;
    const typeName =
      typeof el.type === 'function'
        ? ((el.type as { displayName?: string; name?: string }).displayName
          ?? (el.type as { name?: string }).name
          ?? '[fn]')
        : String(el.type);
    const { children: childrenProp, ...restProps } = el.props as Record<string, unknown>;
    const propsStr = Object.keys(restProps)
      .sort()
      .map((k) => `${k}:${serializeJsx(restProps[k], depth + 1)}`)
      .join(',');
    const childrenStr =
      childrenProp != null
        ? Children.toArray(childrenProp as ReactNode)
            .map((c) => serializeJsx(c, depth + 1))
            .join(',')
        : '';
    return `${typeName}[${el.key ?? ''}](${propsStr}){${childrenStr}}`;
  }
  if (typeof value === 'object') {
    try {
      const obj = value as Record<string, unknown>;
      return `{${Object.keys(obj)
        .sort()
        .map((k) => `${k}:${serializeJsx(obj[k], depth + 1)}`)
        .join(',')}}`;
    } catch {
      return '[obj]';
    }
  }
  return '[unknown]';
};
