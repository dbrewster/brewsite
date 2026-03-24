// MdxEmbedPage.tsx — MDX article with embedded 3D diagrams.
// Demonstrates importing a real .mdx file that uses <SceneEmbed> directly.
// The MDX file is compiled at build time by @mdx-js/rollup — no runtime
// markdown parsing, no custom fenced-code-block hacks.

import { type JSX, useMemo, useState } from 'react';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import { ThemeToggle } from '../Lights';
import { ExampleHeader } from '../ExampleHeader';
import { useThemeCss } from '../hooks/useThemeCss';

// Import the compiled MDX — @mdx-js/rollup compiles this to a React component
// at build time. The .mdx file imports SceneEmbed and scene components directly,
// so no component override for SceneEmbed is needed.
import ArticleContent from './content.mdx';

// ── MDX component overrides (standard HTML elements only) ────────────────────
// The .mdx file handles its own SceneEmbed imports and props. These overrides
// only style the standard markdown-generated HTML elements (tables, etc.).

const mdxComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  // Wrap tables in a scrollable container for narrow viewports.
  table(props: Record<string, unknown>) {
    return (
      <div className="mdx-table-wrapper">
        <table {...props} />
      </div>
    );
  },
};

// ── Page component ──────────────────────────────────────────────────────────

export default function MdxEmbedPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  useThemeCss(family, polarity);

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
          <ArticleContent components={mdxComponents} />
        </div>
      </div>
    </div>
  );
}
