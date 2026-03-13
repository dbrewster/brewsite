// apps/examples/src/slides-demo/deck.tsx
// Enterprise slide deck: "Nexus Platform — Q3 2026 Strategy & Product Update"
// Showcases all layout variants, animated reveals, rich custom layouts,
// speaker notes, and styled content primitives.

import type { ReactElement, CSSProperties } from 'react';
import {
  BulletList,
  Body,
  FullBleedLayout,
  Heading,
  NumberedList,
  Slide,
  TitleBodyLayout,
  TitleLayout,
  TwoColumnLayout,
  BlankLayout,
} from '@brewsite/slides';

// ─── Reusable styled building blocks ────────────────────────────────────────

const accent = 'var(--brewsite-accent-color, #4F76B8)';
const surface = 'var(--slide-color-surface, #1E324F)';
const heading = 'var(--slide-color-heading)';
const body = 'var(--slide-color-body)';
const muted = 'var(--slide-color-muted)';
const font = 'var(--brewsite-font-family)';

/** Styled metric card for KPI dashboards */
function MetricCard({ value, label, delta, positive = true }: {
  value: string; label: string; delta?: string; positive?: boolean;
}): ReactElement {
  return (
    <div style={{
      background: surface,
      borderRadius: '0.75rem',
      padding: 'clamp(1rem, 2vw, 1.5rem)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      border: `1px solid ${accent}22`,
      flex: 1,
      minWidth: 0,
    }}>
      <span style={{ fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, color: heading, lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontFamily: font, fontSize: 'clamp(0.75rem, 1.2vw, 0.95rem)', color: muted, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      {delta && (
        <span style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 1vw, 0.85rem)', color: positive ? '#34D399' : '#F87171', fontWeight: 600 }}>
          {positive ? '\u25B2' : '\u25BC'} {delta}
        </span>
      )}
    </div>
  );
}

/** Styled timeline milestone */
function TimelineMilestone({ quarter, title, description, active = false }: {
  quarter: string; title: string; description: string; active?: boolean;
}): ReactElement {
  return (
    <div style={{
      display: 'flex',
      gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
      alignItems: 'flex-start',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        gap: '0.25rem',
      }}>
        <div style={{
          width: 'clamp(2rem, 3vw, 2.75rem)',
          height: 'clamp(2rem, 3vw, 2.75rem)',
          borderRadius: '50%',
          background: active ? accent : 'transparent',
          border: `2px solid ${active ? accent : muted}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.6rem, 0.9vw, 0.75rem)', fontWeight: 700, color: active ? '#fff' : muted }}>
            {quarter}
          </span>
        </div>
        <div style={{ width: 2, height: 'clamp(1.5rem, 2vw, 2rem)', background: `${muted}44` }} />
      </div>
      <div style={{ paddingTop: '0.25rem' }}>
        <div style={{ fontFamily: font, fontSize: 'clamp(0.9rem, 1.3vw, 1.1rem)', fontWeight: 600, color: active ? heading : body }}>
          {title}
        </div>
        <div style={{ fontFamily: font, fontSize: 'clamp(0.75rem, 1vw, 0.9rem)', color: muted, marginTop: '0.15rem', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
}

/** Styled badge/chip */
function Badge({ children, variant = 'default' }: { children: string; variant?: 'default' | 'success' | 'warning' }): ReactElement {
  const colors = {
    default: { bg: `${accent}22`, fg: accent },
    success: { bg: '#34D39922', fg: '#34D399' },
    warning: { bg: '#FBBF2422', fg: '#FBBF24' },
  };
  const c = colors[variant];
  return (
    <span style={{
      fontFamily: font,
      fontSize: 'clamp(0.65rem, 0.9vw, 0.8rem)',
      fontWeight: 600,
      color: c.fg,
      background: c.bg,
      padding: '0.2em 0.65em',
      borderRadius: '9999px',
      letterSpacing: '0.03em',
    }}>
      {children}
    </span>
  );
}

/** Styled divider with optional label */
function Divider({ label }: { label?: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
      <div style={{ flex: 1, height: 1, background: `${muted}33` }} />
      {label && (
        <span style={{ fontFamily: font, fontSize: 'clamp(0.6rem, 0.8vw, 0.7rem)', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: `${muted}33` }} />
    </div>
  );
}

/** Styled feature row for comparison tables */
function FeatureRow({ feature, before, after }: { feature: string; before: string; after: string }): ReactElement {
  const cellBase: CSSProperties = {
    fontFamily: font,
    fontSize: 'clamp(0.75rem, 1vw, 0.9rem)',
    padding: 'clamp(0.4rem, 0.7vw, 0.6rem) 0',
    borderBottom: `1px solid ${muted}22`,
    lineHeight: 1.4,
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '1rem', alignItems: 'baseline' }}>
      <span style={{ ...cellBase, color: heading, fontWeight: 500 }}>{feature}</span>
      <span style={{ ...cellBase, color: muted }}>{before}</span>
      <span style={{ ...cellBase, color: '#34D399', fontWeight: 500 }}>{after}</span>
    </div>
  );
}

/** Big quote callout */
function QuoteCallout({ quote, attribution }: { quote: string; attribution: string }): ReactElement {
  return (
    <div style={{
      borderLeft: `3px solid ${accent}`,
      paddingLeft: 'clamp(1rem, 2vw, 1.5rem)',
      margin: 'clamp(0.5rem, 1vw, 1rem) 0',
    }}>
      <p style={{ fontFamily: font, fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', color: heading, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
        &ldquo;{quote}&rdquo;
      </p>
      <p style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 1vw, 0.85rem)', color: muted, margin: '0.5rem 0 0' }}>
        &mdash; {attribution}
      </p>
    </div>
  );
}

// ─── Slide 1: Title ─────────────────────────────────────────────────────────

const titleSlide = (
  <Slide
    key="title"
    title="Nexus Platform"
    scrollUnits={100}
    notes="Welcome everyone. Today we're covering Q3 strategy, product milestones, and the go-to-market plan for Nexus Platform."
  >
    <TitleLayout
      title="Nexus Platform"
      subtitle="Q3 2026 Strategy & Product Update"
      alignment="center"
    />
  </Slide>
);

// ─── Slide 2: Agenda ────────────────────────────────────────────────────────

const agendaSlide = (
  <Slide key="agenda" title="Agenda" scrollUnits={200}>
    <TitleBodyLayout title="Today's Agenda">
      <NumberedList
        animateEntrance
        items={[
          'Market context & competitive landscape',
          'Product vision & architecture',
          'Platform metrics & traction',
          'Go-to-market strategy',
          'Engineering roadmap & milestones',
          'Customer case study: Meridian Health',
          'Q3 priorities & resource asks',
        ]}
      />
    </TitleBodyLayout>
  </Slide>
);

// ─── Slide 3: Market Context ────────────────────────────────────────────────

const marketSlide = (
  <Slide key="market" title="Market Context" scrollUnits={500}>
    <TitleBodyLayout title="The Data Infrastructure Inflection Point">
      <BulletList
        animateEntrance
        bulletStyle="arrow"
        items={[
          'Enterprise data volumes growing 28% YoY \u2014 legacy ETL pipelines cannot keep pace',
          'Real-time analytics is now table stakes: 73% of Fortune 500 list it as a top-3 priority',
          'Multi-cloud adoption is accelerating \u2014 67% of enterprises operate across 2+ providers',
          'The $47B data infrastructure market is consolidating around platforms, not point solutions',
          'Regulatory pressure (EU AI Act, DORA) demands full data lineage and auditability',
        ]}
      />
    </TitleBodyLayout>
  </Slide>
);

// ─── Slide 4: Competitive Landscape ─────────────────────────────────────────

const competitiveLandscapeSlide = (
  <Slide key="competitive" title="Competitive Landscape" scrollUnits={400}>
    <TwoColumnLayout
      title="Competitive Landscape"
      left={
        <>
          <Heading level={3}>Legacy Platforms</Heading>
          <BulletList
            bulletStyle="disc"
            items={[
              'Snowflake \u2014 strong analytics, weak streaming',
              'Databricks \u2014 ML-first, complex for ops teams',
              'Confluent \u2014 streaming-native, no analytics layer',
              'Fivetran \u2014 batch ELT only, no real-time path',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>Nexus Advantage</Heading>
          <BulletList
            bulletStyle="checkmark"
            items={[
              'Unified batch + streaming in one engine',
              'Zero-copy multi-cloud data mesh',
              'Built-in governance & lineage from day one',
              'Sub-second query latency at petabyte scale',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── Slide 5: Product Vision (Full-bleed with overlay) ──────────────────────

const visionSlide = (
  <Slide
    key="vision"
    title="Product Vision"
    scrollUnits={200}
    notes="This is our north star. Every feature decision ladders up to this vision."
  >
    <FullBleedLayout overlayPosition="center">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(1rem, 2vw, 1.5rem)',
        textAlign: 'center',
        maxWidth: '40rem',
      }}>
        <Badge variant="default">PRODUCT VISION</Badge>
        <h2 style={{
          fontFamily: font,
          fontSize: 'clamp(1.5rem, 3.5vw, 2.8rem)',
          fontWeight: 700,
          color: heading,
          margin: 0,
          lineHeight: 1.2,
        }}>
          One platform for every data workload &mdash; from ingestion to insight.
        </h2>
        <p style={{
          fontFamily: font,
          fontSize: 'clamp(0.85rem, 1.3vw, 1.1rem)',
          color: body,
          margin: 0,
          lineHeight: 1.6,
          maxWidth: '32rem',
        }}>
          Nexus eliminates the integration tax by unifying streaming, batch processing,
          analytics, and governance into a single control plane that scales with your business.
        </p>
      </div>
    </FullBleedLayout>
  </Slide>
);

// ─── Slide 6: Architecture ──────────────────────────────────────────────────

const architectureSlide = (
  <Slide key="architecture" title="Platform Architecture" scrollUnits={300}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Heading level={2}>Platform Architecture</Heading>
          <Badge variant="success">v2.4</Badge>
        </div>

        {/* Architecture layers */}
        {[
          {
            label: 'Applications',
            color: '#818CF8',
            items: ['Analytics Studio', 'Data Catalog', 'Lineage Explorer', 'Alert Console', 'Admin Portal'],
          },
          {
            label: 'API Gateway',
            color: '#F59E0B',
            items: ['REST / GraphQL', 'gRPC Streaming', 'WebSocket Events', 'SDK (Python / JS / Go)'],
          },
          {
            label: 'Processing Engine',
            color: '#34D399',
            items: ['Stream Processor', 'Batch Scheduler', 'ML Pipeline', 'Query Optimizer', 'Transformation DSL'],
          },
          {
            label: 'Storage Layer',
            color: '#60A5FA',
            items: ['Columnar Store', 'Object Lake', 'Time-Series Index', 'Key-Value Cache', 'Graph Index'],
          },
          {
            label: 'Infrastructure',
            color: '#A78BFA',
            items: ['Multi-Cloud Fabric', 'Auto-Scaling', 'Encryption at Rest', 'mTLS Mesh', 'Observability'],
          },
        ].map((layer) => (
          <div key={layer.label} style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 'clamp(0.5rem, 1vw, 0.75rem)',
            minHeight: 0,
          }}>
            {/* Layer label sidebar */}
            <div style={{
              width: 'clamp(6rem, 10vw, 9rem)',
              flexShrink: 0,
              background: `${layer.color}18`,
              borderLeft: `3px solid ${layer.color}`,
              borderRadius: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              padding: '0.4rem 0.6rem',
            }}>
              <span style={{ fontFamily: font, fontSize: 'clamp(0.6rem, 0.9vw, 0.8rem)', fontWeight: 700, color: layer.color, letterSpacing: '0.02em' }}>
                {layer.label}
              </span>
            </div>
            {/* Layer items */}
            <div style={{ display: 'flex', gap: 'clamp(0.3rem, 0.5vw, 0.5rem)', flex: 1, flexWrap: 'wrap' as const, alignItems: 'center' }}>
              {layer.items.map((item) => (
                <div key={item} style={{
                  background: surface,
                  borderRadius: '0.35rem',
                  padding: 'clamp(0.25rem, 0.5vw, 0.4rem) clamp(0.5rem, 0.8vw, 0.75rem)',
                  fontFamily: font,
                  fontSize: 'clamp(0.6rem, 0.85vw, 0.78rem)',
                  color: body,
                  border: `1px solid ${layer.color}15`,
                  whiteSpace: 'nowrap' as const,
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 7: Platform Metrics (KPI Dashboard) ─────────────────────────────

const metricsSlide = (
  <Slide key="metrics" title="Platform Metrics" scrollUnits={200}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(1rem, 2vw, 1.5rem)',
        justifyContent: 'center',
      }}>
        <Heading level={2}>Platform Metrics</Heading>
        <Body>Key performance indicators through Q2 2026</Body>

        {/* Top row: big numbers */}
        <div style={{ display: 'flex', gap: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
          <MetricCard value="2.4M" label="Events / second" delta="+34% QoQ" positive />
          <MetricCard value="847" label="Enterprise customers" delta="+127 this quarter" positive />
          <MetricCard value="$68M" label="ARR" delta="+42% YoY" positive />
          <MetricCard value="99.997%" label="Uptime (12mo)" delta="5-nines target" positive />
        </div>

        <Divider label="operational health" />

        {/* Bottom row */}
        <div style={{ display: 'flex', gap: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
          <MetricCard value="14ms" label="P95 query latency" delta="-22% from Q1" positive />
          <MetricCard value="3.2 PB" label="Data under management" delta="+800TB QoQ" positive />
          <MetricCard value="12" label="NPS score increase" delta="62 \u2192 74" positive />
          <MetricCard value="4.1x" label="Net revenue retention" delta="vs 3.2x target" positive />
        </div>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 8: Performance Improvements ──────────────────────────────────────

const performanceSlide = (
  <Slide key="performance" title="Performance Gains" scrollUnits={300}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.5rem, 1vw, 0.75rem)',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <Heading level={2}>v2.4 Performance Gains</Heading>
          <Badge variant="success">SHIPPED</Badge>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '1rem', padding: '0 0 0.25rem' }}>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Capability</span>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Before (v2.3)</span>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: '#34D399', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>After (v2.4)</span>
        </div>

        <FeatureRow feature="Cold query startup" before="320ms" after="45ms  (\u22127x)" />
        <FeatureRow feature="Stream ingestion throughput" before="1.8M events/s" after="2.4M events/s" />
        <FeatureRow feature="Cross-region replication lag" before="850ms" after="120ms" />
        <FeatureRow feature="Batch job P99 completion" before="47 min" after="12 min" />
        <FeatureRow feature="Concurrent query capacity" before="2,400" after="8,100" />
        <FeatureRow feature="Memory footprint per node" before="64 GB" after="38 GB" />
        <FeatureRow feature="Time to first query (new tenant)" before="14 min" after="90 sec" />

        <div style={{ marginTop: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
          <QuoteCallout
            quote="The v2.4 cold start improvement alone saved us $1.2M in compute costs last month."
            attribution="Sarah Chen, VP Platform Engineering, Meridian Health"
          />
        </div>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 9: Go-to-Market Strategy ─────────────────────────────────────────

const gtmSlide = (
  <Slide key="gtm" title="Go-to-Market" scrollUnits={500}>
    <TwoColumnLayout
      title="Go-to-Market Strategy"
      left={
        <>
          <Heading level={3}>Land</Heading>
          <BulletList
            animateEntrance
            bulletStyle="arrow"
            items={[
              'Free tier: 100GB storage, 1M events/day',
              'Self-serve onboarding under 5 minutes',
              'Pre-built connectors for top 20 data sources',
              'Developer advocate content: tutorials, templates, SDKs',
            ]}
          />
          <div style={{ height: '0.5rem' }} />
          <Heading level={3}>Expand</Heading>
          <BulletList
            bulletStyle="arrow"
            items={[
              'Usage-based pricing with volume discounts',
              'Team features unlock at 3+ seats',
              'Enterprise SSO and RBAC at $5K/mo tier',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>Revenue Targets</Heading>
          <NumberedList
            items={[
              '$68M ARR \u2192 $95M by end of Q4',
              'Net new logos: 200 enterprise accounts',
              'Land-to-expand conversion: 35% \u2192 48%',
              'Average deal size: $82K \u2192 $110K',
            ]}
          />
          <div style={{ height: '0.5rem' }} />
          <Heading level={3}>Key Bets</Heading>
          <BulletList
            bulletStyle="checkmark"
            items={[
              'AI-powered query optimization (new in Q3)',
              'Marketplace for pre-built pipelines',
              'SOC 2 Type II + HIPAA certification',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── Slide 10: Roadmap Timeline ─────────────────────────────────────────────

const roadmapSlide = (
  <Slide key="roadmap" title="Engineering Roadmap" scrollUnits={300}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
        justifyContent: 'center',
      }}>
        <Heading level={2}>Engineering Roadmap</Heading>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(1rem, 2vw, 2rem)',
          marginTop: '0.25rem',
        }}>
          {/* Left column: timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <TimelineMilestone
              quarter="Q2"
              title="v2.4 \u2014 Performance Release"
              description="Cold start 7x faster, 3.3x concurrent capacity, 40% smaller memory footprint."
              active
            />
            <TimelineMilestone
              quarter="Q3"
              title="v2.5 \u2014 Intelligence Layer"
              description="AI query optimizer, anomaly detection, auto-schema evolution."
            />
            <TimelineMilestone
              quarter="Q4"
              title="v3.0 \u2014 Data Mesh GA"
              description="Federated governance, cross-org data products, marketplace launch."
            />
            <TimelineMilestone
              quarter="Q1 \u201927"
              title="v3.1 \u2014 Real-Time ML"
              description="Feature store, model serving, online/offline consistency guarantees."
            />
          </div>

          {/* Right column: resource allocation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
            <span style={{ fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
              Engineering Allocation (142 engineers)
            </span>

            {[
              { team: 'Stream Processing', pct: 28, color: '#818CF8' },
              { team: 'Query Engine', pct: 22, color: '#34D399' },
              { team: 'Storage Layer', pct: 18, color: '#60A5FA' },
              { team: 'Platform & Infra', pct: 14, color: '#F59E0B' },
              { team: 'AI / ML Runtime', pct: 10, color: '#F472B6' },
              { team: 'Developer Experience', pct: 8, color: '#A78BFA' },
            ].map(({ team, pct, color }) => (
              <div key={team} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 0.95vw, 0.85rem)', color: body }}>{team}</span>
                  <span style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 0.95vw, 0.85rem)', color: heading, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ height: 'clamp(0.35rem, 0.5vw, 0.5rem)', background: `${muted}22`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct * 2.5}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 11: Case Study ───────────────────────────────────────────────────

const caseStudySlide = (
  <Slide
    key="case-study"
    title="Case Study: Meridian Health"
    scrollUnits={500}
    notes="Meridian is our largest healthcare customer. They migrated from a Snowflake + Kafka + Airflow stack to Nexus in 4 months."
  >
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.75rem, 1.5vw, 1rem)',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Heading level={2}>Meridian Health</Heading>
          <Badge>CASE STUDY</Badge>
        </div>
        <Body>
          Meridian Health is a 340-hospital network processing 18M patient events daily.
          They migrated from a fragmented Snowflake + Kafka + Airflow stack to Nexus Platform in 4 months.
        </Body>

        <Divider />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'clamp(0.75rem, 1.5vw, 1.25rem)' }}>
          {/* Result cards */}
          {[
            {
              metric: '73%',
              label: 'Infrastructure cost reduction',
              detail: '$4.2M \u2192 $1.1M monthly spend',
            },
            {
              metric: '11x',
              label: 'Faster time to insight',
              detail: 'Dashboard refresh: 45min \u2192 4min',
            },
            {
              metric: '340',
              label: 'Hospitals on one platform',
              detail: 'Previously siloed across 6 systems',
            },
          ].map((card) => (
            <div key={card.label} style={{
              background: surface,
              borderRadius: '0.75rem',
              padding: 'clamp(1rem, 1.5vw, 1.25rem)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              border: `1px solid ${accent}22`,
            }}>
              <span style={{ fontFamily: font, fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: accent, lineHeight: 1 }}>
                {card.metric}
              </span>
              <span style={{ fontFamily: font, fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)', color: heading, fontWeight: 600 }}>
                {card.label}
              </span>
              <span style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 0.9vw, 0.8rem)', color: muted }}>
                {card.detail}
              </span>
            </div>
          ))}
        </div>

        <QuoteCallout
          quote="Nexus let us retire five separate data systems and gave every clinician real-time visibility into patient flow. That's not a technology win \u2014 it's a patient safety win."
          attribution="Dr. James Okafor, Chief Data Officer, Meridian Health"
        />
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 12: Security & Compliance ────────────────────────────────────────

const securitySlide = (
  <Slide key="security" title="Security & Compliance" scrollUnits={400}>
    <TwoColumnLayout
      title="Security & Compliance"
      left={
        <>
          <Heading level={3}>Certifications</Heading>
          <BulletList
            animateEntrance
            bulletStyle="checkmark"
            items={[
              'SOC 2 Type II (since 2024)',
              'ISO 27001 certified',
              'HIPAA BAA available',
              'GDPR data residency controls',
              'FedRAMP Moderate (in progress)',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>Architecture Principles</Heading>
          <BulletList
            animateEntrance
            bulletStyle="arrow"
            items={[
              'Encryption at rest (AES-256) & in transit (TLS 1.3)',
              'Customer-managed keys via AWS KMS / GCP KMS',
              'Row-level security with attribute-based policies',
              'Full audit log with 7-year retention',
              'Zero-trust network: mTLS service mesh',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── Slide 13: Q3 Priorities ────────────────────────────────────────────────

const prioritiesSlide = (
  <Slide key="priorities" title="Q3 Priorities" scrollUnits={500}>
    <TitleBodyLayout title="Q3 2026 Priorities">
      <BulletList
        animateEntrance
        bulletStyle="arrow"
        items={[
          'Ship v2.5 Intelligence Layer: AI query optimizer, anomaly detection, auto-schema evolution',
          'Close 50+ enterprise deals in healthcare and financial services verticals',
          'Launch self-serve marketplace for pre-built data pipelines and connectors',
          'Achieve SOC 2 Type II re-certification and submit FedRAMP Moderate application',
          'Hire 22 engineers: 8 ML/AI, 6 query engine, 4 platform, 4 DevEx',
          'Reduce customer median time-to-value from 14 days to 5 days',
        ]}
      />
    </TitleBodyLayout>
  </Slide>
);

// ─── Slide 14: Resource Ask ─────────────────────────────────────────────────

const resourceAskSlide = (
  <Slide key="resources" title="Resource Asks" scrollUnits={300}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
        justifyContent: 'center',
      }}>
        <Heading level={2}>Resource Asks</Heading>
        <Body>To hit our Q3 targets, we need approval on three investments.</Body>

        <div style={{ display: 'flex', gap: 'clamp(0.75rem, 1.5vw, 1rem)', marginTop: '0.5rem' }}>
          {[
            {
              number: '01',
              title: 'Headcount: +22 Engineers',
              description: 'Focused on AI runtime (8), query engine (6), platform (4), and developer experience (4). Estimated cost: $4.8M fully loaded.',
              badge: '$4.8M',
              badgeVariant: 'warning' as const,
            },
            {
              number: '02',
              title: 'Infrastructure: GPU Cluster',
              description: 'Dedicated A100 cluster for AI query optimization training and inference. 3-year reserved instance commitment.',
              badge: '$2.1M',
              badgeVariant: 'warning' as const,
            },
            {
              number: '03',
              title: 'Go-to-Market: Sales Expansion',
              description: 'Expand enterprise sales team by 6 AEs focused on healthcare and finserv verticals. Plus $800K for developer marketing.',
              badge: '$3.2M',
              badgeVariant: 'warning' as const,
            },
          ].map((item) => (
            <div key={item.number} style={{
              background: surface,
              borderRadius: '0.75rem',
              padding: 'clamp(1rem, 2vw, 1.5rem)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              flex: 1,
              border: `1px solid ${accent}22`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: font, fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 700, color: `${accent}66` }}>
                  {item.number}
                </span>
                <Badge variant={item.badgeVariant}>{item.badge}</Badge>
              </div>
              <span style={{ fontFamily: font, fontSize: 'clamp(0.85rem, 1.2vw, 1rem)', fontWeight: 600, color: heading }}>
                {item.title}
              </span>
              <span style={{ fontFamily: font, fontSize: 'clamp(0.7rem, 0.95vw, 0.85rem)', color: muted, lineHeight: 1.5 }}>
                {item.description}
              </span>
            </div>
          ))}
        </div>

        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)', color: body }}>
            Total investment ask
          </span>
          <span style={{ fontFamily: font, fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', fontWeight: 700, color: heading }}>
            $10.1M
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: font, fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)', color: body }}>
            Projected Q4 ARR with investment
          </span>
          <span style={{ fontFamily: font, fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', fontWeight: 700, color: '#34D399' }}>
            $95M &nbsp;(+40% YoY)
          </span>
        </div>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Slide 15: Closing ──────────────────────────────────────────────────────

const closingSlide = (
  <Slide key="closing" title="Thank You" scrollUnits={100}>
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'clamp(1rem, 2vw, 1.5rem)',
        textAlign: 'center',
        padding: 'var(--slide-padding, 8%)',
      }}>
        <h1 style={{
          fontFamily: font,
          fontSize: 'clamp(2rem, 5vw, 4rem)',
          fontWeight: 700,
          color: heading,
          margin: 0,
          lineHeight: 1.2,
        }}>
          Thank you.
        </h1>
        <p style={{
          fontFamily: font,
          fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
          color: body,
          margin: 0,
          maxWidth: '28rem',
          lineHeight: 1.6,
        }}>
          Questions? Reach the Nexus team at <span style={{ color: accent, fontWeight: 600 }}>platform@nexus.dev</span>
        </p>
        <Divider />
        <p style={{
          fontFamily: font,
          fontSize: 'clamp(0.7rem, 1vw, 0.85rem)',
          color: muted,
          margin: 0,
        }}>
          Nexus Platform &middot; Q3 2026 Strategy &middot; Confidential
        </p>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Exported slide array ───────────────────────────────────────────────────

export const demoSlides: ReactElement[] = [
  titleSlide,
  agendaSlide,
  marketSlide,
  competitiveLandscapeSlide,
  visionSlide,
  architectureSlide,
  metricsSlide,
  performanceSlide,
  gtmSlide,
  roadmapSlide,
  caseStudySlide,
  securitySlide,
  prioritiesSlide,
  resourceAskSlide,
  closingSlide,
];
