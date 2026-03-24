// Three-layer component map builder for MDX content rendering.

import React from 'react';
import type { ComponentType, ReactNode, ReactElement } from 'react';
import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import {
  SceneEmbed, Scene,
  Camera,
  Background,
  Lighting, Ambient, Directional,
  Environment,
  Floor,
} from '@brewsite/core';
import type { SceneEmbedProps } from '@brewsite/core';
import { CodeBlock, Callout } from '@brewsite/docs';
import type { CalloutType, CodeLanguage } from '@brewsite/docs';
import {
  Diagram, DiagramNode, DiagramEdge, DiagramGroup, FlowLayout,
} from '@brewsite/diagram';
import { slugify } from './toc';

// NOTE: In published form, @brewsite/docs and @brewsite/diagram would use
// dynamic import or conditional logic to handle the optional peer dependency.
// In this monorepo they are always available, so we import them statically.

/**
 * Component map type used by MDX evaluate().
 * MDX passes Record<string, unknown> as props to component overrides,
 * so all components in the map must accept that shape.
 */
type ComponentMap = Record<string, ComponentType<Record<string, unknown>>>;

/** Set of recognized CodeLanguage values for type-safe checking. */
const SUPPORTED_CODE_LANGUAGES = new Set<string>(['tsx', 'typescript', 'bash', 'json', 'css']);

/**
 * Returns the language string as a CodeLanguage if it matches a supported value,
 * otherwise undefined (which causes CodeBlock to use its default).
 */
function toCodeLanguage(lang: string): CodeLanguage | undefined {
  // Safe narrowing: only return a CodeLanguage when the value is in the known set
  return SUPPORTED_CODE_LANGUAGES.has(lang) ? lang as CodeLanguage : undefined;
}

/**
 * Checks whether a URL string is external (starts with http:// or https://).
 */
function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith('http://') || href.startsWith('https://');
}

/**
 * Extracts the text content from a ReactNode by recursively walking
 * React element children. Used for generating heading ids from JSX children.
 */
function childrenToText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join('');
  if (React.isValidElement(children)) {
    const el = children as ReactElement<{ children?: ReactNode }>;
    return childrenToText(el.props.children);
  }
  return '';
}

/**
 * Creates a heading component with an auto-generated slug id.
 */
function createHeadingComponent(
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
): ComponentType<Record<string, unknown>> {
  const HeadingComponent = (props: Record<string, unknown>): ReactElement => {
    const text = childrenToText(props.children as ReactNode);
    const id = slugify(text);
    return React.createElement(tag, { ...props, id });
  };
  HeadingComponent.displayName = `MdxHeading_${tag}`;
  return HeadingComponent;
}

/**
 * Builds Layer 1: HTML element defaults with slugified heading ids and table wrapper.
 * Always present regardless of which optional packages are installed.
 */
function buildHtmlDefaults(): ComponentMap {
  const TableWrapper = (props: Record<string, unknown>): ReactElement => {
    return React.createElement(
      'div',
      { className: 'bw-mdx-table-wrapper' },
      React.createElement('table', props),
    );
  };
  TableWrapper.displayName = 'MdxTableWrapper';

  const SmartLink = (props: Record<string, unknown>): ReactElement => {
    const href = typeof props.href === 'string' ? props.href : undefined;
    const extraProps = isExternalHref(href)
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {};
    return React.createElement('a', { ...props, ...extraProps });
  };
  SmartLink.displayName = 'MdxSmartLink';

  return {
    h1: createHeadingComponent('h1'),
    h2: createHeadingComponent('h2'),
    h3: createHeadingComponent('h3'),
    h4: createHeadingComponent('h4'),
    h5: createHeadingComponent('h5'),
    h6: createHeadingComponent('h6'),
    table: TableWrapper,
    a: SmartLink,
  };
}

/**
 * Extracts code props (language + content) from a fenced code block's
 * pre > code element structure as rendered by MDX.
 */
function extractCodeProps(children: ReactNode): { language: string; content: string } {
  if (!React.isValidElement(children)) {
    return { language: 'typescript', content: '' };
  }
  const codeEl = children as ReactElement<{
    className?: string;
    children?: ReactNode;
  }>;
  const className = codeEl.props.className ?? '';
  const langMatch = /language-(\w+)/.exec(className);
  const language = langMatch ? langMatch[1] : 'typescript';
  const content = childrenToText(codeEl.props.children);
  return { language, content };
}

/**
 * Detects whether a blockquote is a callout (starts with **Note:**,
 * **Warning:**, or **Tip:**). Returns the callout type and remaining
 * content, or null if not a callout.
 */
function detectCalloutType(children: ReactNode): { type: CalloutType; content: ReactNode } | null {
  const text = childrenToText(children);
  const trimmed = text.trimStart();

  if (trimmed.startsWith('Note:') || trimmed.startsWith('**Note:**')) {
    return { type: 'note', content: children };
  }
  if (trimmed.startsWith('Warning:') || trimmed.startsWith('**Warning:**')) {
    return { type: 'warning', content: children };
  }
  if (trimmed.startsWith('Tip:') || trimmed.startsWith('**Tip:**')) {
    return { type: 'tip', content: children };
  }
  return null;
}

/**
 * Builds Layer 2: @brewsite/docs components (CodeBlock, Callout).
 * Maps fenced code blocks to CodeBlock and callout-style blockquotes to Callout.
 */
function buildDocsComponents(): ComponentMap {
  const PreBlock = (props: Record<string, unknown>): ReactElement => {
    const { language, content } = extractCodeProps(props.children as ReactNode);
    return React.createElement(CodeBlock, { code: content, language: toCodeLanguage(language) });
  };
  PreBlock.displayName = 'MdxPreBlock';

  const BlockquoteOrCallout = (props: Record<string, unknown>): ReactElement => {
    const callout = detectCalloutType(props.children as ReactNode);
    if (callout) {
      return React.createElement(Callout, { type: callout.type, children: callout.content });
    }
    return React.createElement('blockquote', props);
  };
  BlockquoteOrCallout.displayName = 'MdxBlockquoteOrCallout';

  return {
    pre: PreBlock,
    blockquote: BlockquoteOrCallout,
  };
}

/**
 * Builds Layer 3: BrewSite scene components with injected plugin/theme config.
 * SceneEmbed, Scene, and Diagram DSL components are always available in MDX
 * content without explicit imports.
 */
function buildBrewSiteComponents(
  plugins?: WidgetPlugin[],
  theme?: ActiveTheme,
): ComponentMap {
  // SceneEmbed with auto-injected plugins + theme.
  // MDX passes arbitrary props from the content author, which are spread
  // after the injected defaults so author overrides win.
  const InjectedSceneEmbed = (props: Record<string, unknown>): ReactElement => {
    const mergedProps = { plugins, theme, ...props } as unknown as SceneEmbedProps;
    return React.createElement(SceneEmbed, mergedProps);
  };
  InjectedSceneEmbed.displayName = 'MdxSceneEmbed';

  // DSL null-returning components accept specific prop types but MDX passes
  // them through as Record<string, unknown>. The component map requires
  // ComponentType<Record<string, unknown>> which is structurally compatible
  // since these components accept any props and return null.
  // Cast helper — DSL components accept specific props but MDX passes
  // Record<string, unknown>. The cast is safe because these components
  // only read the props they recognize and ignore the rest.
  const c = <T,>(component: T): ComponentType<Record<string, unknown>> =>
    component as unknown as ComponentType<Record<string, unknown>>;

  return {
    // Core engine
    SceneEmbed: InjectedSceneEmbed,
    Scene: c(Scene),
    Camera: c(Camera),
    Background: c(Background),
    Lighting: c(Lighting),
    Ambient: c(Ambient),
    Directional: c(Directional),
    Environment: c(Environment),
    Floor: c(Floor),
    // Diagram DSL
    Diagram: c(Diagram),
    DiagramNode: c(DiagramNode),
    DiagramEdge: c(DiagramEdge),
    DiagramGroup: c(DiagramGroup),
    FlowLayout: c(FlowLayout),
  };
}

/**
 * Creates the merged default component map for MDX rendering.
 *
 * The map is built from three layers (lowest to highest priority):
 * 1. HTML element defaults (headings with ids, table wrapper, smart links)
 * 2. @brewsite/docs components (CodeBlock, Callout) when installed
 * 3. BrewSite scene components (SceneEmbed, Scene, Diagram DSL)
 *
 * Consumer-provided components override all layers.
 */
export function createDefaultComponents(
  plugins?: WidgetPlugin[],
  theme?: ActiveTheme,
): ComponentMap {
  return {
    ...buildHtmlDefaults(),
    ...buildDocsComponents(),
    ...buildBrewSiteComponents(plugins, theme),
  };
}
