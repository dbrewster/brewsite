// Page component rendering all theme family × polarity variants side-by-side for visual review.
import { Fragment } from 'react';
import type { ThemeFamily } from '@brewsite/core';
import type { JSX } from 'react';
import { bundles } from '@brewsite/themes';
import { ThemeSwatchCard } from './ThemeSwatchCard';

const FAMILIES = Object.keys(bundles) as (keyof typeof bundles)[];

// Build lookup maps from the themes bundles
const CHART_THEME_PAIRS = Object.fromEntries(
  FAMILIES.map(family => [family, { dark: bundles[family].chart.dark, light: bundles[family].chart.light }])
) as Record<ThemeFamily, { dark: (typeof bundles)['enterprise']['chart']['dark']; light: (typeof bundles)['enterprise']['chart']['light'] }>;

const DIAGRAM_THEME_PAIRS = Object.fromEntries(
  FAMILIES.map(family => [family, { dark: bundles[family].diagram.dark, light: bundles[family].diagram.light }])
) as Record<ThemeFamily, { dark: (typeof bundles)['enterprise']['diagram']['dark']; light: (typeof bundles)['enterprise']['diagram']['light'] }>;

export default function ThemeGalleryPage(): JSX.Element {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', background: '#1a1a1a', minHeight: '100vh' }}>
      <style>{`
        .theme-gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          max-width: 520px;
        }
        @media (max-width: 540px) {
          .theme-gallery-grid {
            grid-template-columns: 1fr;
            max-width: 100%;
          }
        }
      `}</style>
      <h1 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Theme Family Gallery</h1>
      <p style={{ color: '#aaa', fontSize: 13, marginBottom: 24 }}>
        All family × polarity variants. Dark polarity left, light polarity right.
        Projection bar = projection.color. Card border = tooltip.borderColor.
      </p>

      {/* Chart themes grid */}
      <h2 style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>@brewsite/charts</h2>
      <div className="theme-gallery-grid" style={{ marginBottom: 40 }}>
        {FAMILIES.map((family) => {
          const dark = bundles[family].chart.dark;
          const light = bundles[family].chart.light;
          return (
            <Fragment key={family}>
              <ThemeSwatchCard
                label={`${family} / dark`}
                backgroundColor={dark.background.planeColor ?? '#111'}
                palette={dark.series.map((s) => s.color)}
                projectionColor={dark.projection?.color ?? '#888'}
                tooltipBorderColor={dark.tooltip?.borderColor ?? '#444'}
                textColor={dark.axis.labelColor}
              />
              <ThemeSwatchCard
                label={`${family} / light`}
                backgroundColor={light.background.planeColor ?? '#fff'}
                palette={light.series.map((s) => s.color)}
                projectionColor={light.projection?.color ?? '#888'}
                tooltipBorderColor={light.tooltip?.borderColor ?? '#ccc'}
                textColor={light.axis.labelColor}
              />
            </Fragment>
          );
        })}
      </div>

      {/* Diagram themes grid */}
      <h2 style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>@brewsite/diagram</h2>
      <div className="theme-gallery-grid">
        {FAMILIES.map((family) => {
          const dark = bundles[family].diagram.dark;
          const light = bundles[family].diagram.light;
          return (
            <Fragment key={`diag-${family}`}>
              <ThemeSwatchCard
                label={`${family} / dark`}
                backgroundColor={dark.node.defaultColor}
                palette={dark.palette ?? []}
                projectionColor={dark.edge.defaultFlowColor ?? '#888'}
                tooltipBorderColor={dark.edge.defaultColor}
                textColor={dark.node.defaultLabelColor}
              />
              <ThemeSwatchCard
                label={`${family} / light`}
                backgroundColor={light.node.defaultColor}
                palette={light.palette ?? []}
                projectionColor={light.edge.defaultFlowColor ?? '#888'}
                tooltipBorderColor={light.edge.defaultColor}
                textColor={light.node.defaultLabelColor}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
