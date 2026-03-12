// Page component rendering all 12 theme family × polarity variants side-by-side for visual review.
import { Fragment } from 'react';
import type { JSX } from 'react';
import { CHART_THEME_PAIRS } from '@brewsite/charts';
import { DIAGRAM_THEME_PAIRS } from '@brewsite/diagram';
import { ThemeSwatchCard } from './ThemeSwatchCard';
import type { ThemeFamily } from '@brewsite/core';

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

export default function ThemeGalleryPage(): JSX.Element {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', background: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Theme Family Gallery</h1>
      <p style={{ color: '#aaa', fontSize: 13, marginBottom: 24 }}>
        All 12 family × polarity variants. Dark polarity left, light polarity right.
        Projection bar = projection.color. Card border = tooltip.borderColor.
      </p>

      {/* Chart themes grid */}
      <h2 style={{ color: '#ccc', fontSize: 14, marginBottom: 12 }}>@brewsite/charts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 520, marginBottom: 40 }}>
        {FAMILIES.map((family) => {
          const dark = CHART_THEME_PAIRS[family].dark;
          const light = CHART_THEME_PAIRS[family].light;
          return (
            <Fragment key={family}>
              <ThemeSwatchCard
                label={`${family} / dark`}
                backgroundColor={dark.background.planeColor ?? '#111'}
                palette={dark.series.map(s => s.color)}
                projectionColor={dark.projection?.color ?? '#888'}
                tooltipBorderColor={dark.tooltip?.borderColor ?? '#444'}
                textColor={dark.axis.labelColor}
              />
              <ThemeSwatchCard
                label={`${family} / light`}
                backgroundColor={light.background.planeColor ?? '#fff'}
                palette={light.series.map(s => s.color)}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 520 }}>
        {FAMILIES.map((family) => {
          const dark = DIAGRAM_THEME_PAIRS[family].dark;
          const light = DIAGRAM_THEME_PAIRS[family].light;
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
