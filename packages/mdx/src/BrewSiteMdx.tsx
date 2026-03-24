// Main BrewSiteMdx component — runtime MDX rendering with BrewSite integration.

import React, { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import type { BrewSiteMdxProps } from './types';
import { useMdxCompile } from './useMdxCompile';
import { createDefaultComponents } from './defaultComponents';

/**
 * Default error fallback component shown when MDX compilation fails.
 */
function DefaultErrorFallback({ error }: { error: Error }): ReactElement {
  return React.createElement(
    'div',
    {
      className: 'bw-mdx-error',
      style: {
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #cc3333',
        background: '#1a0000',
        color: '#ff6666',
        fontFamily: 'monospace',
        fontSize: '13px',
        whiteSpace: 'pre-wrap',
      },
    },
    React.createElement('strong', null, 'MDX compilation error'),
    React.createElement('br'),
    React.createElement('span', null, error.message),
  );
}

/**
 * Runtime MDX renderer with built-in BrewSite component integration.
 *
 * Takes an MDX source string, compiles it in the browser, and renders
 * the result with pre-registered BrewSite components (SceneEmbed,
 * Diagram DSL, etc.) and built-in documentation components (CodeBlock,
 * Callout).
 *
 * Supports YAML frontmatter extraction, heading TOC generation, caching,
 * loading/error states, and theme/plugin injection for embedded scenes.
 */
export function BrewSiteMdx(props: BrewSiteMdxProps): ReactElement | null {
  const {
    children,
    plugins,
    theme,
    components: consumerComponents,
    onFrontmatter,
    onToc,
    placeholder = null,
    errorFallback: ErrorFallback = DefaultErrorFallback,
    className,
  } = props;

  const { Content, error, isCompiling, frontmatter, toc } = useMdxCompile(children);

  // Build default component map with plugin/theme injection
  const defaultComponents = useMemo(
    () => createDefaultComponents(plugins, theme),
    [plugins, theme],
  );

  // Merge: defaults < consumer overrides
  const mergedComponents = useMemo(() => {
    if (!consumerComponents) return defaultComponents;
    return { ...defaultComponents, ...consumerComponents };
  }, [defaultComponents, consumerComponents]);

  // Fire onFrontmatter callback when frontmatter changes
  const prevFrontmatterRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    if (onFrontmatter && frontmatter !== prevFrontmatterRef.current) {
      prevFrontmatterRef.current = frontmatter;
      onFrontmatter(frontmatter);
    }
  }, [frontmatter, onFrontmatter]);

  // Fire onToc callback when toc changes
  const prevTocRef = useRef(toc);
  useEffect(() => {
    if (onToc && toc !== prevTocRef.current) {
      prevTocRef.current = toc;
      onToc(toc);
    }
  }, [toc, onToc]);

  // Build CSS classes for wrapper div
  const wrapperClasses = ['bw-mdx'];
  if (className) wrapperClasses.push(className);
  if (theme) {
    wrapperClasses.push(theme.polarity === 'dark' ? 'bw-dark' : 'bw-light');
    if (theme.family) {
      wrapperClasses.push(`bw-theme-${theme.family}`);
    }
  }

  // Error state
  if (error) {
    return React.createElement(
      'div',
      { className: wrapperClasses.join(' ') },
      React.createElement(ErrorFallback, { error }),
    );
  }

  // Loading state
  if (isCompiling || !Content) {
    return React.createElement(
      'div',
      { className: wrapperClasses.join(' ') },
      placeholder,
    );
  }

  // Render compiled content
  return React.createElement(
    'div',
    { className: wrapperClasses.join(' ') },
    React.createElement(Content, { components: mergedComponents }),
  );
}
