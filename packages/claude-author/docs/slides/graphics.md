---
title: Slide Graphics Components
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## StatCard

Displays a metric value with label, optional trend indicator, and optional icon. Renders as an elevated card with border and shadow.

```typescript
type StatCardProps = {
  value: string | number;
  label: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { StatCard } from '@brewsite/slides';

<StatCard value="$4.2M" label="Revenue" trend="+32%" trendDirection="up" />
<StatCard value={98.7} label="Uptime %" icon={<span>{">"}</span>} />
```

Trend arrows render automatically: `trendDirection="up"` shows an up arrow, `"down"` shows a down arrow, `"neutral"` shows a dash. Colors come from `--brewsite-color-success`, `--brewsite-color-error`, and `--brewsite-text-secondary` respectively.

## Timeline

Displays a sequence of milestones connected by a line. Supports vertical (default) and horizontal orientation.

```typescript
type TimelineProps = {
  items: Array<{
    label: string;
    description?: string;
    date?: string;
    icon?: ReactNode;
    active?: boolean;
  }>;
  orientation?: 'horizontal' | 'vertical';
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { Timeline } from '@brewsite/slides';

<Timeline
  items={[
    { label: 'Research', date: 'Q1 2026', description: 'Market analysis', active: true },
    { label: 'Design', date: 'Q2 2026', description: 'UX prototyping' },
    { label: 'Build', date: 'Q3 2026', description: 'Engineering sprint' },
    { label: 'Launch', date: 'Q4 2026', description: 'GA release' },
  ]}
  orientation="vertical"
/>
```

Active items get an accent-colored dot (`--brewsite-accent-color`). Connector width comes from `--slide-timeline-connector-width`, dot size from `--slide-timeline-dot-size`.

## ProcessSteps

Displays an ordered list of process steps with numbered circles and an active step indicator.

```typescript
type ProcessStepsProps = {
  steps: Array<{
    title: string;
    description?: string;
    icon?: ReactNode;
  }>;
  activeStep?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { ProcessSteps } from '@brewsite/slides';

<ProcessSteps
  steps={[
    { title: 'Sign Up', description: 'Create your account' },
    { title: 'Configure', description: 'Set team preferences' },
    { title: 'Deploy', description: 'Push to production' },
  ]}
  activeStep={1}
/>
```

Steps at or before `activeStep` show an accent-colored circle. Completed steps display a checkmark. Steps after `activeStep` show a muted numbered circle.

## IconGrid

Displays items in a grid layout with icons and labels. Good for feature grids, capability lists, or technology stacks.

```typescript
type IconGridProps = {
  items: Array<{
    icon: ReactNode;
    label: string;
    description?: string;
  }>;
  columns?: 2 | 3 | 4;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { IconGrid } from '@brewsite/slides';

<IconGrid
  columns={3}
  items={[
    { icon: <span>{'<>'}</span>, label: 'TypeScript', description: 'Type-safe' },
    { icon: <span>{'R'}</span>, label: 'React', description: 'Component-based' },
    { icon: <span>{'3D'}</span>, label: 'Three.js', description: 'WebGL rendering' },
  ]}
/>
```

## ComparisonTable

Feature comparison table with typed cell values and optional column highlighting. Cell values use the `ComparisonCellValue` discriminated union.

```typescript
type ComparisonTableProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { ComparisonTable } from '@brewsite/slides';

<ComparisonTable
  headers={['Free', 'Pro', 'Enterprise']}
  highlightColumn={1}
  rows={[
    { feature: 'Users', values: [
      { kind: 'number', value: 5 },
      { kind: 'number', value: 100 },
      { kind: 'text', value: 'Unlimited' },
    ]},
    { feature: 'SSO', values: [
      { kind: 'check', value: false },
      { kind: 'check', value: true },
      { kind: 'check', value: true },
    ]},
  ]}
/>
```

The highlighted column gets `--brewsite-accent-color` header text and `--brewsite-surface-elevated` background on data cells.

## ProgressRing

Circular progress indicator with a percentage value displayed in the center and an optional label below.

```typescript
type ProgressRingProps = {
  value: number; // 0-100
  label?: string;
  size?: string;
  thickness?: string;
  color?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { ProgressRing } from '@brewsite/slides';

<ProgressRing value={78} label="Completion" />
<ProgressRing value={95} label="Uptime" size="80px" thickness="6px" color="#22c55e" />
```

Defaults: `size` = `var(--slide-progress-ring-size)` (64px), `thickness` = `var(--slide-progress-ring-thickness)` (4px), `color` = `var(--brewsite-accent-color)`.

## ProgressBar

Horizontal progress bar with optional label showing the percentage value.

```typescript
type ProgressBarProps = {
  value: number; // 0-100
  label?: string;
  color?: string;
  height?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { ProgressBar } from '@brewsite/slides';

<ProgressBar value={65} label="Sprint Progress" />
<ProgressBar value={90} label="Budget Used" color="var(--brewsite-color-warning, #f59e0b)" height="12px" />
```

Default `height` is `'8px'`. Default `color` is `var(--brewsite-accent-color)`.

## CalloutBox

Styled callout box with a variant-colored left border and optional icon and title.

```typescript
type CalloutBoxProps = {
  variant?: 'info' | 'warning' | 'success' | 'error' | 'neutral';
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { CalloutBox } from '@brewsite/slides';

<CalloutBox variant="info" title="Note">
  All metrics are measured over a trailing 30-day window.
</CalloutBox>

<CalloutBox variant="warning" title="Action Required">
  Migration deadline is March 31st. Contact your admin to schedule.
</CalloutBox>
```

Variant border colors: `info` = `--brewsite-accent-color`, `warning` = `--brewsite-color-warning`, `success` = `--brewsite-color-success`, `error` = `--brewsite-color-error`, `neutral` = `--brewsite-border-subtle`.

## QuoteBlock

Styled blockquote with accent-colored left border and attribution footer.

```typescript
type QuoteBlockProps = {
  quote: string;
  attribution: string;
  role?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { QuoteBlock } from '@brewsite/slides';

<QuoteBlock
  quote="The best way to predict the future is to invent it."
  attribution="Alan Kay"
  role="Computer Scientist"
/>
```

The quote text renders in italic with `--brewsite-text-primary` color. Attribution renders below with `--brewsite-text-secondary`.

## MetricRow

Horizontal row of metric values with labels and optional icons. Good for compact KPI strips.

```typescript
type MetricRowProps = {
  items: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { MetricRow } from '@brewsite/slides';

<MetricRow items={[
  { value: '12K', label: 'Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '< 200ms', label: 'P95 Latency' },
]} />
```

Items are distributed with `justify-content: space-around`. Values render at 1.5em bold, labels at 0.85em secondary color.

## Badge

Small pill-shaped badge with variant coloring.

```typescript
type BadgeProps = {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { Badge } from '@brewsite/slides';

<Badge label="New" variant="info" />
<Badge label="Deprecated" variant="warning" />
<Badge label="Stable" variant="success" />
```

`default` variant renders with `--brewsite-surface-elevated` background and `--brewsite-text-secondary` text with a subtle border. All other variants use a solid colored background with white text.

## Divider

Horizontal divider line with variant styling.

```typescript
type DividerProps = {
  variant?: 'solid' | 'dashed' | 'gradient';
  className?: string;
  style?: CSSProperties;
};
```

```tsx
import { Divider } from '@brewsite/slides';

<Divider />
<Divider variant="dashed" />
<Divider variant="gradient" />
```

The `gradient` variant renders as a 1px horizontal line that fades from transparent through `--brewsite-border-subtle` and back to transparent.

## ComparisonCellValue Type

Discriminated union used by `ComparisonTable` and `ComparisonSlide` for typed table cells.

```typescript
type ComparisonCellValue =
  | { readonly kind: 'check'; readonly value: boolean }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number };
```

Rendering: `check` cells display a checkmark or X, `text` cells display the string, `number` cells display the number as a string.

## Graphics Components and CSS Variables

All graphics components consume `--brewsite-*` CSS variables from `SceneTheme` for visual styling (colors, fonts, spacing, shadows) and `--slide-*` CSS variables from `SlideTheme` for component sizing and density.

Key variables consumed across graphics components:
- `--brewsite-text-primary`, `--brewsite-text-secondary` — text colors
- `--brewsite-accent-color` — highlight/accent color
- `--brewsite-surface-elevated` — card/elevated surface background
- `--brewsite-border-subtle` — border and separator color
- `--brewsite-shadow-sm` — card shadow
- `--brewsite-spacing-md` — internal padding
- `--slide-content-gap` — gap between items in lists/grids
- `--slide-card-border-width` — border width for cards and table cells
- `--slide-timeline-connector-width`, `--slide-timeline-dot-size` — Timeline component sizing
- `--slide-progress-ring-size`, `--slide-progress-ring-thickness` — ProgressRing defaults

## Using Graphics with Animation

Many graphics components accept a `progress` prop (a number from 0 to 1) that controls entrance opacity. When `progress` is `undefined`, the component renders at full opacity. When provided, the component's container opacity is set to the `progress` value.

Combine with `useProgressWindow` to create animated entrances:

```tsx
import { ContentSlide, StatCard, useProgressWindow } from '@brewsite/slides';

function AnimatedStats() {
  const p = useProgressWindow(0.1, 0.5);
  return (
    <ContentSlide title="Results">
      <StatCard value="$4.2M" label="Revenue" progress={p} />
    </ContentSlide>
  );
}
```
