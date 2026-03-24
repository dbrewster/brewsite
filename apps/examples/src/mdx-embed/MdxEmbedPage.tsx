// MdxEmbedPage.tsx — MDX article with embedded 3D diagrams.
// Demonstrates runtime MDX compilation via @brewsite/mdx.
// The .mdx file is imported as a raw string (Vite ?raw suffix) and compiled
// at runtime in the browser — no build-time MDX plugin needed.
// All BrewSite components (SceneEmbed, Diagram DSL, etc.) are pre-registered
// by BrewSiteMdx and available in the content without import statements.

import { type JSX, useMemo, useState } from 'react';
import type { ActiveTheme, ThemeFamily, ThemePolarity } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';
import { BrewSiteMdx, type TocEntry } from '@brewsite/mdx';
import { DeployPipelineScene } from './scenes/DeployPipelineScene';
// Vite's ?raw suffix imports the .mdx file as a plain string — no compilation,
// no Vite plugin. In production, this string would come from fetch('/api/docs/...').
import ARTICLE_CONTENT from './content.mdx?raw';
import { ThemeToggle } from '../Lights';
import { ExampleHeader } from '../ExampleHeader';
import { useThemeCss } from '../hooks/useThemeCss';

// ── Page component ──────────────────────────────────────────────────────────

export default function MdxEmbedPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);
  useThemeCss(family, polarity);

  const plugins = useMemo(() => [corePlugin(), diagramPlugin(), themesPlugin()], []);
  const [toc, setToc] = useState<TocEntry[]>([]);

  // Custom components available in the MDX content beyond the built-in BrewSite set.
  // DeployPipelineScene is a pre-built scene component referenced by name in the MDX.
  const extraComponents = useMemo(() => ({
    DeployPipelineScene,
  }), []);

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
          <BrewSiteMdx
            plugins={plugins}
            theme={theme}
            components={extraComponents}
            onToc={setToc}
            placeholder={<div style={{ padding: '2rem', opacity: 0.4 }}>Compiling...</div>}
          >
            {ARTICLE_CONTENT}
          </BrewSiteMdx>
        </div>
      </div>
    </div>
  );
}
