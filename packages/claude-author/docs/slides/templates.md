---
title: Slide Template System
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## What SlideTemplate Is

`SlideTemplate` is the corporate chrome layer for slide decks. It controls logo placement, footer text and page numbers, and watermarks. These elements appear on every slide (with per-layout exclusion rules). `SlideTemplate` is orthogonal to `SceneTheme` (visual) and `SlideTheme` (feel) — changing one does not affect the others.

The template is passed to `SlidePlayer` via the `template` prop. When no template is provided, no corporate chrome is rendered.

## SlideTemplate Type

The full `SlideTemplate` type from `packages/slides/src/types.ts`:

```typescript
type SlideTemplate = {
  readonly name: string;

  readonly brand?: {
    readonly logo?: BrandAsset;
    readonly wordmark?: BrandAsset;
    readonly icon?: BrandAsset;
  };

  readonly master?: {
    readonly logo?: {
      readonly asset: 'logo' | 'wordmark' | 'icon';
      readonly position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      readonly size?: string;
      readonly opacity?: number;
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly footer?: {
      readonly text?: string;
      readonly showPageNumbers?: boolean;
      readonly showDate?: boolean;
      readonly position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly watermark?: {
      readonly text?: string;
      readonly image?: string;
      readonly opacity?: number;
    };
  };

  readonly defaultTransition?: SlideTransition;
  readonly defaultProgressIndicator?: ProgressStyle;
};
```

`brand` defines up to three brand assets (logo, wordmark, icon) that can be referenced by `master.logo.asset`. `master` defines the corporate chrome elements: where the logo goes, what the footer says, and whether a watermark is present. `defaultTransition` sets the slide transition for the entire deck (overridable per-slide). `defaultProgressIndicator` sets the progress indicator style (`'dots'` | `'bar'` | `'numbers'` | `'none'`).

## BrandAsset Type

```typescript
type BrandAsset = {
  readonly src: string;
  readonly alt?: string;
  readonly aspectRatio?: string;
};
```

`src` is the URL or path to the image asset. `alt` is the accessible alt text. `aspectRatio` is a CSS aspect-ratio string (e.g., `'16/9'`, `'1/1'`).

## Using a Template

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, ContentSlide, Body, slidesPlugin } from '@brewsite/slides';
import type { SlideTemplate } from '@brewsite/slides';

const acmeTemplate: SlideTemplate = {
  name: 'Acme Corp',
  brand: {
    logo: { src: '/acme-logo.svg', alt: 'Acme' },
    wordmark: { src: '/acme-wordmark.svg', alt: 'Acme Corporation' },
  },
  master: {
    logo: {
      asset: 'logo',
      position: 'top-right',
      size: '36px',
      opacity: 0.8,
      excludeLayouts: ['title'],
    },
    footer: {
      text: 'Confidential',
      showPageNumbers: true,
      position: 'bottom-center',
    },
    watermark: {
      text: 'DRAFT',
      opacity: 0.03,
    },
  },
  defaultTransition: 'dissolve',
  defaultProgressIndicator: 'dots',
};

function Deck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer template={acmeTemplate}>
        <Slide key="intro"><TitleSlide title="Annual Report 2026" /></Slide>
        <Slide key="overview"><ContentSlide title="Overview"><Body>Company highlights.</Body></ContentSlide></Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

`excludeLayouts` on `master.logo` prevents the logo from appearing on title slides. The footer shows "Confidential" text with page numbers on every slide (unless excluded). The watermark renders at 3% opacity across all slides.

The `defaultTransition` and `defaultProgressIndicator` from the template are used as fallbacks. `SlidePlayer` props override them: `transition` prop overrides `defaultTransition`, `progressIndicator` prop overrides `defaultProgressIndicator`.

## Template CSS Variables

`resolveTemplate` injects these CSS custom properties on the `SlidePlayer` container:

- `--slide-footer-height` — `'32px'` when a footer is configured, `'0px'` otherwise
- `--slide-logo-size` — the `size` value from `master.logo` (default `'40px'`), or `'0px'` when no logo
- `--slide-watermark-opacity` — the `opacity` value from `master.watermark` (default `0.05`), or `'0'` when no watermark

## resolveTemplate Function

```typescript
function resolveTemplate(template?: SlideTemplate): ResolvedTemplate | undefined;
```

Returns `undefined` when no template is provided. Otherwise returns:

```typescript
type ResolvedTemplate = {
  readonly template: SlideTemplate;
  readonly cssVars: Record<string, string>;
};
```

`template` is the original `SlideTemplate` object passed through. `cssVars` is a flat map of CSS custom property names to values, merged onto the `SlidePlayer` container's style alongside the `--slide-*` variables from `SlideTheme`.

```tsx
import { resolveTemplate } from '@brewsite/slides';
import type { SlideTemplate } from '@brewsite/slides';

const template: SlideTemplate = {
  name: 'Acme',
  master: {
    footer: { text: 'Acme Inc.', showPageNumbers: true, position: 'bottom-right' },
  },
};

const resolved = resolveTemplate(template);
// resolved.cssVars:
// { '--slide-footer-height': '32px', '--slide-logo-size': '0px', '--slide-watermark-opacity': '0' }
```

## Combining Template with Theme

`SlideTemplate`, `SlideTheme`, and `SceneTheme` all work together. The template controls corporate chrome placement, the slide theme controls timing and density, and the scene theme controls colors and fonts.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, BigNumberSlide,
  Body, cinematicSlideTheme, slidesPlugin,
} from '@brewsite/slides';
import type { SlideTemplate } from '@brewsite/slides';

const template: SlideTemplate = {
  name: 'Acme Corp',
  brand: { logo: { src: '/acme-logo.svg', alt: 'Acme' } },
  master: {
    logo: { asset: 'logo', position: 'top-right', size: '32px', opacity: 0.7, excludeLayouts: ['title', 'full-bleed'] },
    footer: { text: 'Acme Corp - Confidential', showPageNumbers: true, showDate: true, position: 'bottom-center' },
  },
  defaultTransition: 'fade',
};

function PolishedDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer
        slideTheme={cinematicSlideTheme}
        template={template}
        progressIndicator="bar"
      >
        <Slide key="title">
          <TitleSlide title="Investor Update" subtitle="Q4 2026" />
        </Slide>
        <Slide key="numbers">
          <BigNumberSlide
            title="Key Metrics"
            stats={[
              { value: '$12.4M', label: 'ARR', trend: '+45%', trendDirection: 'up' },
              { value: '340', label: 'Enterprise Clients', trend: '+28%', trendDirection: 'up' },
            ]}
          />
        </Slide>
        <Slide key="next">
          <ContentSlide title="What's Next">
            <Body>Expanding into EMEA and APAC markets in 2027.</Body>
          </ContentSlide>
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

In this example:
- `cinematicSlideTheme` provides spacious layout with slow, elegant transitions (500ms, 1.4x heading scale)
- `template` adds the Acme logo in the top-right corner (excluded on title slides), a footer with confidential text and page numbers, and a default fade transition
- `SceneTheme` from the parent `SceneEngine` provides the color palette and font family via `--brewsite-*` variables
- `progressIndicator="bar"` overrides the template's default (which would be `'dots'` if not specified)
