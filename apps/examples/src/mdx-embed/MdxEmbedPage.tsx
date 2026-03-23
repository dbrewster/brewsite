// MdxEmbedPage.tsx — Markdown article with embedded 3D diagrams.
// Demonstrates using react-markdown with custom component mapping
// to render SceneEmbed instances inline within documentation content.

import { type JSX, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import {
  type ActiveTheme,
  SceneEmbed,
  type ThemeFamily,
  type ThemePolarity,
} from '@brewsite/core';
import { createMdxEmbedPlugins } from './widgetSetup';
import { AuthFlowScene } from './scenes/AuthFlowScene';
import { DeployPipelineScene } from './scenes/DeployPipelineScene';
import { ARTICLE_CONTENT } from './content';
import { ThemeToggle } from '../Lights';
import { ExampleHeader, useFpsCap } from '../ExampleHeader';
import { StatsOverlay } from '../StatsOverlay';
import { useThemeCss } from '../hooks/useThemeCss';

// ── Scene registry ────────────────────────────────────────────────────────────
// Maps diagram IDs (from ```diagram blocks) to React scene components.

const SCENE_REGISTRY: Record<string, () => JSX.Element> = {
  'auth-flow': AuthFlowScene,
  'deploy-pipeline': DeployPipelineScene,
};

// ── Inline diagram component ──────────────────────────────────────────────────

function InlineDiagram({
  sceneId,
  theme,
  fpsCap,
}: {
  sceneId: string;
  theme: ActiveTheme;
  fpsCap: number | undefined;
}): JSX.Element {
  const SceneComponent = SCENE_REGISTRY[sceneId];
  const plugins = useMemo(() => createMdxEmbedPlugins(), []);

  if (!SceneComponent) {
    return (
      <div className="mdx-diagram-error">
        Unknown diagram: <code>{sceneId}</code>
      </div>
    );
  }

  return (
    <div className="mdx-diagram-wrapper">
      <SceneEmbed
        height={380}
        plugins={plugins}
        theme={theme}
        defaultTransitionDuration={500}
        timingProfile={{ fpsCap }}
        interactive
        visibility="autopause"
      >
        <SceneComponent />
        <StatsOverlay />
      </SceneEmbed>
      <div className="mdx-diagram-caption">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        Interactive 3D &mdash; scroll to orbit, pinch to zoom
      </div>
    </div>
  );
}

// ── Markdown component overrides ──────────────────────────────────────────────

function useMarkdownComponents(
  theme: ActiveTheme,
  fpsCap: number | undefined,
): Components {
  return useMemo((): Components => ({
    // Map fenced ```diagram blocks to live SceneEmbed instances.
    // react-markdown renders fenced code as <pre><code className="language-diagram">...</code></pre>
    pre(props) {
      const child = props.children;
      // react-markdown renders fenced code as <pre><code className="language-diagram">...</code></pre>.
      // Extract the code element's props to check for the diagram language marker.
      type CodeProps = { className?: string; children?: React.ReactNode };
      if (
        child &&
        typeof child === 'object' &&
        'props' in child
      ) {
        const codeProps = child.props as CodeProps;
        if (codeProps.className === 'language-diagram') {
          const sceneId = String(codeProps.children ?? '').trim();
          return <InlineDiagram sceneId={sceneId} theme={theme} fpsCap={fpsCap} />;
        }
      }
      return <pre {...props} />;
    },
    // Style standard markdown elements for the article layout.
    table(props) {
      return (
        <div className="mdx-table-wrapper">
          <table {...props} />
        </div>
      );
    },
  }), [theme, fpsCap]);
}

// ── Page component ────────────────────────────────────────────────────────────

export default function MdxEmbedPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  const fpsCap = useFpsCap();
  useThemeCss(family, polarity);

  const components = useMarkdownComponents(theme, fpsCap);

  return (
    <div className="ex-page">
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{ position: 'static', zIndex: 'auto' }}
        />
      </ExampleHeader>

      <div className="ex-scroll-content" style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="mdx-article">
          <Markdown components={components}>
            {ARTICLE_CONTENT}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
