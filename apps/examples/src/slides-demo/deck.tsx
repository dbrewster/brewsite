// apps/examples/src/slides-demo/deck.tsx
// Enterprise slide deck: "Nexus Platform — Q3 2026 Strategy & Product Update"
// Showcases all layout variants, animated reveals, rich custom layouts,
// speaker notes, and styled content primitives.

import type {CSSProperties, ReactElement} from 'react';
import {BlankLayout, Body, BulletList, FullBleedLayout, Heading, NumberedList, Slide, TitleBodyLayout, TitleLayout, TwoColumnLayout,} from '@brewsite/slides';
import {Ambient, Camera, Directional, Floor, Lighting, View} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout,} from '@brewsite/diagram';
import {BarChart, ChartAxis, ChartData, ChartLegend, ChartSeries,} from '@brewsite/charts';

// ─── Reusable styled building blocks ────────────────────────────────────────

const accent = 'var(--brewsite-accent-color, #4F76B8)';
const surface = 'var(--slide-color-surface, #1E324F)';
const heading = 'var(--slide-color-heading)';
const body = 'var(--slide-color-body)';
const muted = 'var(--slide-color-muted)';
const font = 'var(--brewsite-font-family)';

/** Styled metric card for KPI dashboards */
function MetricCard({value, label, delta, positive = true}: {
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
      <span style={{fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 700, color: heading, lineHeight: 1.1}}>
        {value}
      </span>
      <span style={{fontFamily: font, fontSize: 'clamp(0.75rem, 1.2vw, 0.95rem)', color: muted, letterSpacing: '0.04em', textTransform: 'uppercase' as const}}>
        {label}
      </span>
      {delta && (
        <span style={{fontFamily: font, fontSize: 'clamp(0.7rem, 1vw, 0.85rem)', color: positive ? '#34D399' : '#F87171', fontWeight: 600}}>
          {positive ? '\u25B2' : '\u25BC'} {delta}
        </span>
      )}
    </div>
  );
}

/** Styled badge/chip */
function Badge({children, variant = 'default'}: { children: string; variant?: 'default' | 'success' | 'warning' }): ReactElement {
  const colors = {
    default: {bg: `${accent}22`, fg: accent},
    success: {bg: '#34D39922', fg: '#34D399'},
    warning: {bg: '#FBBF2422', fg: '#FBBF24'},
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
function Divider({label}: { label?: string }): ReactElement {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%'}}>
      <div style={{flex: 1, height: 1, background: `${muted}33`}}/>
      {label && (
        <span style={{fontFamily: font, fontSize: 'clamp(0.6rem, 0.8vw, 0.7rem)', color: muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, flexShrink: 0}}>
          {label}
        </span>
      )}
      <div style={{flex: 1, height: 1, background: `${muted}33`}}/>
    </div>
  );
}

/** Styled feature row for comparison tables */
function FeatureRow({feature, before, after}: { feature: string; before: string; after: string }): ReactElement {
  const cellBase: CSSProperties = {
    fontFamily: font,
    fontSize: 'clamp(0.75rem, 1vw, 0.9rem)',
    padding: 'clamp(0.4rem, 0.7vw, 0.6rem) 0',
    borderBottom: `1px solid ${muted}22`,
    lineHeight: 1.4,
  };
  return (
    <div style={{display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '1rem', alignItems: 'baseline'}}>
      <span style={{...cellBase, color: heading, fontWeight: 500}}>{feature}</span>
      <span style={{...cellBase, color: muted}}>{before}</span>
      <span style={{...cellBase, color: '#34D399', fontWeight: 500}}>{after}</span>
    </div>
  );
}

/** Big quote callout */
function QuoteCallout({quote, attribution}: { quote: string; attribution: string }): ReactElement {
  return (
    <div style={{
      borderLeft: `3px solid ${accent}`,
      paddingLeft: 'clamp(1rem, 2vw, 1.5rem)',
      margin: 'clamp(0.5rem, 1vw, 1rem) 0',
    }}>
      <p style={{fontFamily: font, fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', color: heading, fontStyle: 'italic', margin: 0, lineHeight: 1.5}}>
        &ldquo;{quote}&rdquo;
      </p>
      <p style={{fontFamily: font, fontSize: 'clamp(0.7rem, 1vw, 0.85rem)', color: muted, margin: '0.5rem 0 0'}}>
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
          'Enterprise data volumes growing 28% YoY — legacy ETL pipelines cannot keep pace',
          'Real-time analytics is now table stakes: 73% of Fortune 500 list it as a top-3 priority',
          'Multi-cloud adoption is accelerating — 67% of enterprises operate across 2+ providers',
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
              'Snowflake — strong analytics, weak streaming',
              'Databricks — ML-first, complex for ops teams',
              'Confluent — streaming-native, no analytics layer',
              'Fivetran — batch ELT only, no real-time path',
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
  <Slide
    key="architecture"
    title="Platform Architecture"
    scrollUnits={300}
    sceneDsl={<>
      <Camera mode="world" position={[0, 2.5, 5]} target={[0, 0, 0]} fov={36}/>
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff"/>
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]}/>
      </Lighting>
      <Floor variant="grid"/>

      <Diagram id="arch-layers" x={0.08} y={0.05} w={0.84} h={0.9} tilt={-0.25}>
        <FlowLayout direction="top-down" gap={0.9}/>

        <DiagramNode id="apps" label="Applications" sublabel="Analytics · Catalog · Lineage"
                     shape="rectangle" icon="ui:squares-2x2" size={[3, 3]} thickness={0.2}/>

        <DiagramNode id="api" label="API Gateway" sublabel="REST · gRPC · WebSocket"
                     shape="hexagon" icon="net:internet" size={[5, 2.5]} thickness={0.2}/>

        <DiagramGroup id="engine" label="Processing Engine" variant="container">
          <GridLayout columns={3} spacing={[0.8, 0.6]}/>
          <DiagramNode id="stream" label="Stream" sublabel="Real-time" icon="data:stream" shape="circle" size={[2.8, 2.8]} thickness={0.2}/>
          <DiagramNode id="batch" label="Batch" sublabel="Scheduled" icon="data:warehouse" shape="circle" size={[2.8, 2.8]} thickness={0.2}/>
          <DiagramNode id="ml" label="ML Pipeline" sublabel="Inference" icon="ui:cpu-chip" shape="circle" size={[2.8, 2.8]} thickness={0.2}/>
        </DiagramGroup>

        <DiagramNode id="storage" label="Storage Layer" sublabel="Columnar · Object Lake · KV"
                     shape="octagon" icon="data:warehouse" size={[5, 2.8]} thickness={0.2}/>

        <DiagramNode id="infra" label="Infrastructure" sublabel="Multi-Cloud · Auto-Scale"
                     shape="rectangle" icon="security:shield" size={[3, 3]} thickness={0.2}/>

        <DiagramEdge from="apps" to="api" routing="flow" flow="forward"/>
        <DiagramEdge from="api" to="stream" routing="flow" flow="forward"/>
        <DiagramEdge from="api" to="batch" routing="flow" flow="forward"/>
        <DiagramEdge from="api" to="ml" routing="flow" flow="forward"/>
        <DiagramEdge from="stream" to="storage" routing="flow" flow="forward"/>
        <DiagramEdge from="batch" to="storage" routing="flow" flow="forward"/>
        <DiagramEdge from="ml" to="storage" routing="flow" flow="forward"/>
        <DiagramEdge from="storage" to="infra" routing="flow" flow="forward"/>
      </Diagram>
    </>}
  >
    <BlankLayout/>
  </Slide>
);

// ─── Slide 7: Platform Metrics (KPI Dashboard) ─────────────────────────────

const metricsSlide = (
  <Slide
    key="metrics"
    title="Platform Metrics"
    scrollUnits={200}
    sceneDsl={<>
      <Camera mode="world" position={[0, 2.5, 5]} target={[0, 0, 0]} fov={36}/>
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff"/>
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]}/>
      </Lighting>
      <Floor variant="grid"/>

      <View id='c1' x={0.52} y={0.1} w={0.44} h={0.8}>
        <BarChart
          id="metrics-chart"
          data={[
            {quarter: 'Q1', events: 1.2, customers: 580, arr: 38},
            {quarter: 'Q2', events: 1.8, customers: 720, arr: 48},
            {quarter: 'Q3', events: 2.1, customers: 790, arr: 58},
            {quarter: 'Q4', events: 2.4, customers: 847, arr: 68},
          ]}
          x={0.52} y={0.1} w={0.44} h={0.8}
          depth={0.4}
          animateEntry
        >
          <ChartData keyField="quarter"/>
          <ChartAxis axis="x" field="quarter" label="Quarter"/>
          <ChartAxis axis="y" field="arr" label="ARR ($M)"/>
          <ChartSeries field="arr" label="ARR"/>
          <ChartSeries field="events" label="Events/s (M)"/>
          <ChartLegend visible position="right"/>
        </BarChart>
      </View>
    </>}
  >
    <BlankLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--slide-padding, 8%)',
        gap: 'clamp(0.75rem, 1.5vw, 1rem)',
        justifyContent: 'center',
        maxWidth: '48%',
      }}>
        <Heading level={2}>Platform Metrics</Heading>
        <Body>Key performance indicators through Q2 2026</Body>

        <div style={{display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1vw, 0.75rem)'}}>
          <MetricCard value="2.4M" label="Events / second" delta="+34% QoQ" positive/>
          <MetricCard value="847" label="Enterprise customers" delta="+127 this quarter" positive/>
          <MetricCard value="$68M" label="ARR" delta="+42% YoY" positive/>
          <MetricCard value="99.997%" label="Uptime (12mo)" delta="5-nines target" positive/>
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
        <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem'}}>
          <Heading level={2}>v2.4 Performance Gains</Heading>
          <Badge variant="success">SHIPPED</Badge>
        </div>

        {/* Table header */}
        <div style={{display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '1rem', padding: '0 0 0.25rem'}}>
          <span
            style={{fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const}}>Capability</span>
          <span
            style={{fontFamily: font, fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)', color: muted, letterSpacing: '0.08em', textTransform: 'uppercase' as const}}>Before (v2.3)</span>
          <span style={{
            fontFamily: font,
            fontSize: 'clamp(0.65rem, 0.85vw, 0.75rem)',
            color: '#34D399',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const
          }}>After (v2.4)</span>
        </div>

        <FeatureRow feature="Cold query startup" before="320ms" after="45ms  (\u22127x)"/>
        <FeatureRow feature="Stream ingestion throughput" before="1.8M events/s" after="2.4M events/s"/>
        <FeatureRow feature="Cross-region replication lag" before="850ms" after="120ms"/>
        <FeatureRow feature="Batch job P99 completion" before="47 min" after="12 min"/>
        <FeatureRow feature="Concurrent query capacity" before="2,400" after="8,100"/>
        <FeatureRow feature="Memory footprint per node" before="64 GB" after="38 GB"/>
        <FeatureRow feature="Time to first query (new tenant)" before="14 min" after="90 sec"/>

        <div style={{marginTop: 'clamp(0.25rem, 0.5vw, 0.5rem)'}}>
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
          <div style={{height: '0.5rem'}}/>
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
          <div style={{height: '0.5rem'}}/>
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
  <Slide
    key="roadmap"
    title="Engineering Roadmap"
    scrollUnits={300}
    sceneDsl={<>
      <Camera mode="world" position={[0, 0, 5]} target={[0, 0, 0]} fov={36}/>
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff"/>
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]}/>
      </Lighting>
      <Floor variant="grid"/>

      <Diagram id="roadmap-timeline" x={0.05} y={0.02} w={0.9} h={0.96} tilt={-.25}>
        <FlowLayout direction="top-down" gap={1.0}/>

        <DiagramNode id="q2" label={"Q2 \u2014 v2.4"} sublabel="Performance Release"
                     shape="hexagon" icon="ui:cpu-chip" size={[12, 8]} thickness={2} glow={{intensity: 0.2}}/>
        <DiagramNode id="q3" label={"Q3 \u2014 v2.5"} sublabel="Intelligence Layer"
                     shape="hexagon" icon="ui:cpu-chip" size={[12, 8]} thickness={2}/>
        <DiagramNode id="q4" label={"Q4 \u2014 v3.0"} sublabel="Data Mesh GA"
                     shape="hexagon" icon="data:warehouse" size={[12, 8]} thickness={2}/>
        <DiagramNode id="q1-27" label={"Q1 '27 \u2014 v3.1"} sublabel="Real-Time ML"
                     shape="hexagon" icon="data:stream" size={[12, 8]} thickness={2}/>

        <DiagramEdge from="q2" to="q3" routing="flow" flow="forward"/>
        <DiagramEdge from="q3" to="q4" routing="flow" flow="forward"/>
        <DiagramEdge from="q4" to="q1-27" routing="flow" flow="forward"/>
      </Diagram>
    </>}
  >
    <BlankLayout/>
  </Slide>
);

// ─── Slide 11: Case Study ───────────────────────────────────────────────────

const caseStudySlide = (
  <Slide
    key="case-study"
    title="Case Study: Meridian Health"
    scrollUnits={500}
    notes="Meridian is our largest healthcare customer. They migrated from a Snowflake + Kafka + Airflow stack to Nexus in 4 months."
    sceneDsl={<>
      <Camera mode="world" position={[0, 2.5, 5]} target={[0, 0, 0]} fov={36}/>
      <Lighting>
        <Ambient intensity={2.5} color="#d7e5ff"/>
        <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]}/>
      </Lighting>
      <Floor variant="grid"/>

      <Diagram id="case-study-migration" x={0.08} y={0.05} w={0.84} h={0.9} tilt={-0.25}>
        <FlowLayout direction="top-down" gap={2.2}/>

        <DiagramGroup id="before" label="Before: 3 Separate Systems" variant="container">
          <GridLayout columns={3} spacing={[1.0, 0.6]}/>
          <DiagramNode id="snowflake" label="Snowflake" sublabel="Analytics" icon="data:warehouse" shape="diamond" size={[4, 4]} thickness={0.2}/>
          <DiagramNode id="kafka" label="Kafka" sublabel="Streaming" icon="data:stream" shape="diamond" size={[4, 4]} thickness={0.2}/>
          <DiagramNode id="airflow" label="Airflow" sublabel="Orchestration" icon="ui:arrow-path" shape="diamond" size={[4, 4]} thickness={0.2}/>
        </DiagramGroup>

        <DiagramNode id="nexus" label="Nexus Platform" sublabel="Unified Infrastructure"
                     icon="ui:cpu-chip" shape="hexagon" size={[5, 3.5]} thickness={0.3} glow={{intensity: 0.2}}/>

        <DiagramEdge from="snowflake" to="nexus" routing="flow" flow="forward"/>
        <DiagramEdge from="kafka" to="nexus" routing="flow" flow="forward"/>
        <DiagramEdge from="airflow" to="nexus" routing="flow" flow="forward"/>
      </Diagram>
    </>}
  >
    <BlankLayout/>
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

        <div style={{display: 'flex', gap: 'clamp(0.75rem, 1.5vw, 1rem)', marginTop: '0.5rem'}}>
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
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <span style={{fontFamily: font, fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 700, color: `${accent}66`}}>
                  {item.number}
                </span>
                <Badge variant={item.badgeVariant}>{item.badge}</Badge>
              </div>
              <span style={{fontFamily: font, fontSize: 'clamp(0.85rem, 1.2vw, 1rem)', fontWeight: 600, color: heading}}>
                {item.title}
              </span>
              <span style={{fontFamily: font, fontSize: 'clamp(0.7rem, 0.95vw, 0.85rem)', color: muted, lineHeight: 1.5}}>
                {item.description}
              </span>
            </div>
          ))}
        </div>

        <Divider/>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: font, fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)', color: body}}>
            Total investment ask
          </span>
          <span style={{fontFamily: font, fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', fontWeight: 700, color: heading}}>
            $10.1M
          </span>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: font, fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)', color: body}}>
            Projected Q4 ARR with investment
          </span>
          <span style={{fontFamily: font, fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', fontWeight: 700, color: '#34D399'}}>
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
          Questions? Reach the Nexus team at <span style={{color: accent, fontWeight: 600}}>platform@nexus.dev</span>
        </p>
        <Divider/>
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
