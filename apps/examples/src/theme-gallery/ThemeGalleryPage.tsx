// Page component rendering all theme family x polarity variants side-by-side for visual review.
import { Fragment } from 'react';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import type { JSX } from 'react';
import { bundles } from '@brewsite/themes';
import { ThemeSwatchCard } from './ThemeSwatchCard';
import { ExampleHeader } from '../ExampleHeader';
import { useThemeCss } from '../hooks/useThemeCss';

const FAMILIES = Object.keys(bundles) as (keyof typeof bundles)[];

// Build lookup maps from the themes bundles
const CHART_THEME_PAIRS = Object.fromEntries(
  FAMILIES.map(family => [family, { dark: bundles[family].chart.dark, light: bundles[family].chart.light }])
) as Record<ThemeFamily, { dark: (typeof bundles)['enterprise']['chart']['dark']; light: (typeof bundles)['enterprise']['chart']['light'] }>;

const DIAGRAM_THEME_PAIRS = Object.fromEntries(
  FAMILIES.map(family => [family, { dark: bundles[family].diagram.dark, light: bundles[family].diagram.light }])
) as Record<ThemeFamily, { dark: (typeof bundles)['enterprise']['diagram']['dark']; light: (typeof bundles)['enterprise']['diagram']['light'] }>;

export default function ThemeGalleryPage(): JSX.Element {
  const family = (localStorage.getItem('themeFamily') as ThemeFamily) ?? 'darkGlass';
  const polarity = (localStorage.getItem('themePolarity') as ThemePolarity) ?? 'dark';
  useThemeCss(family, polarity);

  return (
    <div className="ex-gallery">
      <ExampleHeader />
      <div className="ex-gallery__content">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Theme Family Gallery</h1>
      <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 24 }}>
        All family x polarity variants. Dark polarity left, light polarity right.
        Projection bar = projection.color. Card border = tooltip.borderColor.
      </p>

      {/* Chart themes grid */}
      <h2 style={{ opacity: 0.7, fontSize: 14, marginBottom: 12 }}>@brewsite/charts</h2>
      <div className="ex-gallery__grid" style={{ marginBottom: 40 }}>
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
      <h2 style={{ opacity: 0.7, fontSize: 14, marginBottom: 12 }}>@brewsite/diagram</h2>
      <div className="ex-gallery__grid">
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
    </div>
  );
}
