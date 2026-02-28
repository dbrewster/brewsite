import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

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
