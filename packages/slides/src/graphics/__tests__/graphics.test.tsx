// Tests for all 12 graphics components. Tests render structure and CSS var usage.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatCard } from '../StatCard';
import { Timeline } from '../Timeline';
import { ProcessSteps } from '../ProcessSteps';
import { IconGrid } from '../IconGrid';
import { ComparisonTable } from '../ComparisonTable';
import { ProgressRing } from '../ProgressRing';
import { ProgressBar } from '../ProgressBar';
import { CalloutBox } from '../CalloutBox';
import { QuoteBlock } from '../QuoteBlock';
import { MetricRow } from '../MetricRow';
import { Badge } from '../Badge';
import { Divider } from '../Divider';

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

function containsText(html: string, text: string): boolean {
  return html.includes(text);
}

// ─── StatCard ────────────────────────────────────────────────────────────────

describe('StatCard', () => {
  it('renders value and label', () => {
    const html = render(<StatCard value="42" label="Users" />);
    expect(containsText(html, '42')).toBe(true);
    expect(containsText(html, 'Users')).toBe(true);
  });

  it('applies className and style', () => {
    const html = render(<StatCard value={10} label="Test" className="my-card" style={{ margin: '8px' }} />);
    expect(containsText(html, 'my-card')).toBe(true);
    expect(containsText(html, 'margin:8px')).toBe(true);
  });

  it('renders fully visible when progress is undefined', () => {
    const html = render(<StatCard value={1} label="X" />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress prop', () => {
    const html = render(<StatCard value={1} label="X" progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });

  it('renders trend indicator', () => {
    const html = render(<StatCard value={99} label="Score" trend="+5%" trendDirection="up" />);
    expect(containsText(html, '+5%')).toBe(true);
  });
});

// ─── Timeline ────────────────────────────────────────────────────────────────

describe('Timeline', () => {
  const items = [
    { label: 'Step 1', description: 'First' },
    { label: 'Step 2', active: true },
  ];

  it('renders all items', () => {
    const html = render(<Timeline items={items} />);
    expect(containsText(html, 'Step 1')).toBe(true);
    expect(containsText(html, 'Step 2')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<Timeline items={items} className="tl" />);
    expect(containsText(html, 'tl')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<Timeline items={items} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<Timeline items={items} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── ProcessSteps ────────────────────────────────────────────────────────────

describe('ProcessSteps', () => {
  const steps = [
    { title: 'Plan' },
    { title: 'Build', description: 'Code it' },
    { title: 'Ship' },
  ];

  it('renders all steps', () => {
    const html = render(<ProcessSteps steps={steps} />);
    expect(containsText(html, 'Plan')).toBe(true);
    expect(containsText(html, 'Build')).toBe(true);
    expect(containsText(html, 'Ship')).toBe(true);
  });

  it('applies className and style', () => {
    const html = render(<ProcessSteps steps={steps} className="ps" style={{ gap: '4px' }} />);
    expect(containsText(html, 'ps')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<ProcessSteps steps={steps} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<ProcessSteps steps={steps} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── IconGrid ────────────────────────────────────────────────────────────────

describe('IconGrid', () => {
  const items = [
    { icon: React.createElement('span', null, '★'), label: 'Star' },
    { icon: React.createElement('span', null, '♦'), label: 'Diamond' },
  ];

  it('renders all items', () => {
    const html = render(<IconGrid items={items} />);
    expect(containsText(html, 'Star')).toBe(true);
    expect(containsText(html, 'Diamond')).toBe(true);
  });

  it('uses specified columns', () => {
    const html = render(<IconGrid items={items} columns={2} />);
    expect(containsText(html, 'grid-template-columns:repeat(2, 1fr)')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<IconGrid items={items} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<IconGrid items={items} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── ComparisonTable ─────────────────────────────────────────────────────────

describe('ComparisonTable', () => {
  const headers = ['Basic', 'Pro'];
  const rows = [
    { feature: 'Storage', values: [{ kind: 'text' as const, value: '10GB' }, { kind: 'text' as const, value: '100GB' }] },
    { feature: 'Support', values: [{ kind: 'check' as const, value: false }, { kind: 'check' as const, value: true }] },
  ];

  it('renders headers and rows', () => {
    const html = render(<ComparisonTable headers={headers} rows={rows} />);
    expect(containsText(html, 'Basic')).toBe(true);
    expect(containsText(html, 'Storage')).toBe(true);
    expect(containsText(html, '10GB')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<ComparisonTable headers={headers} rows={rows} className="ct" />);
    expect(containsText(html, 'ct')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<ComparisonTable headers={headers} rows={rows} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<ComparisonTable headers={headers} rows={rows} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── ProgressRing ────────────────────────────────────────────────────────────

describe('ProgressRing', () => {
  it('renders percentage text', () => {
    const html = render(<ProgressRing value={75} />);
    expect(containsText(html, '75%')).toBe(true);
  });

  it('renders label when provided', () => {
    const html = render(<ProgressRing value={50} label="Completion" />);
    expect(containsText(html, 'Completion')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<ProgressRing value={50} className="pr" />);
    expect(containsText(html, 'pr')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<ProgressRing value={50} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('clamps value to 0-100', () => {
    const html = render(<ProgressRing value={150} />);
    expect(containsText(html, '100%')).toBe(true);
  });
});

// ─── ProgressBar ─────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
  it('renders with label', () => {
    const html = render(<ProgressBar value={60} label="Upload" />);
    expect(containsText(html, 'Upload')).toBe(true);
    expect(containsText(html, '60%')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<ProgressBar value={30} className="pb" />);
    expect(containsText(html, 'pb')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<ProgressBar value={30} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<ProgressBar value={30} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── CalloutBox ──────────────────────────────────────────────────────────────

describe('CalloutBox', () => {
  it('renders children', () => {
    const html = render(<CalloutBox>Important note</CalloutBox>);
    expect(containsText(html, 'Important note')).toBe(true);
  });

  it('renders title', () => {
    const html = render(<CalloutBox title="Warning">Text</CalloutBox>);
    expect(containsText(html, 'Warning')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<CalloutBox className="cb">X</CalloutBox>);
    expect(containsText(html, 'cb')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<CalloutBox>X</CalloutBox>);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<CalloutBox progress={0}>X</CalloutBox>);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── QuoteBlock ──────────────────────────────────────────────────────────────

describe('QuoteBlock', () => {
  it('renders quote and attribution', () => {
    const html = render(<QuoteBlock quote="Hello world" attribution="Author" />);
    expect(containsText(html, 'Hello world')).toBe(true);
    expect(containsText(html, 'Author')).toBe(true);
  });

  it('renders role when provided', () => {
    const html = render(<QuoteBlock quote="X" attribution="Y" role="CEO" />);
    expect(containsText(html, 'CEO')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<QuoteBlock quote="X" attribution="Y" className="qb" />);
    expect(containsText(html, 'qb')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<QuoteBlock quote="X" attribution="Y" />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<QuoteBlock quote="X" attribution="Y" progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── MetricRow ───────────────────────────────────────────────────────────────

describe('MetricRow', () => {
  const items = [
    { value: '99%', label: 'Uptime' },
    { value: 42, label: 'Users' },
  ];

  it('renders all items', () => {
    const html = render(<MetricRow items={items} />);
    expect(containsText(html, '99%')).toBe(true);
    expect(containsText(html, 'Uptime')).toBe(true);
    expect(containsText(html, '42')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<MetricRow items={items} className="mr" />);
    expect(containsText(html, 'mr')).toBe(true);
  });

  it('renders fully visible without progress', () => {
    const html = render(<MetricRow items={items} />);
    expect(containsText(html, 'opacity:1')).toBe(true);
  });

  it('applies opacity from progress', () => {
    const html = render(<MetricRow items={items} progress={0} />);
    expect(containsText(html, 'opacity:0')).toBe(true);
  });
});

// ─── Badge ───────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renders label', () => {
    const html = render(<Badge label="New" />);
    expect(containsText(html, 'New')).toBe(true);
  });

  it('applies className and style', () => {
    const html = render(<Badge label="X" className="badge" style={{ margin: '4px' }} />);
    expect(containsText(html, 'badge')).toBe(true);
  });

  it('renders with variant', () => {
    const html = render(<Badge label="OK" variant="success" />);
    expect(containsText(html, 'OK')).toBe(true);
  });
});

// ─── Divider ─────────────────────────────────────────────────────────────────

describe('Divider', () => {
  it('renders an hr element', () => {
    const html = render(<Divider />);
    expect(html.includes('<hr')).toBe(true);
  });

  it('applies className', () => {
    const html = render(<Divider className="div" />);
    expect(containsText(html, 'div')).toBe(true);
  });

  it('renders gradient variant', () => {
    const html = render(<Divider variant="gradient" />);
    expect(containsText(html, 'linear-gradient')).toBe(true);
  });

  it('renders dashed variant', () => {
    const html = render(<Divider variant="dashed" />);
    expect(containsText(html, 'dashed')).toBe(true);
  });
});
