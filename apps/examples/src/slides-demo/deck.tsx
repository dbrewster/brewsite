// apps/examples/src/slides-demo/deck.tsx
// Enterprise slide deck: "Nexus Platform — Q3 2026 Strategy & Product Update"
// Showcases all new Phase 1B layout DSL components, graphics components,
// entrance animations, section dividers, and 3D sceneDsl content.

import type { ReactElement } from 'react';
import {
  Slide,
  // Phase 1B Layout DSL
  TitleSlide,
  SectionSlide,
  ContentSlide,
  TwoColumnSlide,
  FullBleedSlide,
  BlankSlide,
  BigNumberSlide,
  ComparisonSlide,
  QuoteSlide,
  AgendaSlide,
  // Text Primitives
  Heading,
  Body,
  BulletList,
  NumberedList,
  // Graphics Components
  StatCard,
  Timeline,
  ProcessSteps,
  Badge,
  Divider,
  CalloutBox,
  QuoteBlock,
  MetricRow,
} from '@brewsite/slides';
import type { ComparisonCellValue } from '@brewsite/slides';
import { Ambient, Camera, Directional, Floor, Lighting, View } from '@brewsite/core';
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  FlowLayout,
  GridLayout,
} from '@brewsite/diagram';
import {
  BarChart,
  ChartAxis,
  ChartData,
  ChartLegend,
  ChartSeries,
} from '@brewsite/charts';

// ─── 3D scene boilerplate — shared by slides with sceneDsl ──────────────────

const sceneLighting = (
  <>
    <Lighting>
      <Ambient intensity={2.5} color="#d7e5ff" />
      <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" />
  </>
);

const sceneCamera = (
  <Camera mode="world" position={[0, 2.5, 5]} target={[0, 0, 0]} fov={36} />
);

const sceneCameraFlat = (
  <Camera mode="world" position={[0, 0, 5]} target={[0, 0, 0]} fov={36} />
);

// ─── Slide 1: Title ─────────────────────────────────────────────────────────

const titleSlide = (
  <Slide
    key="title"
    title="Nexus Platform"
    scrollUnits={100}
    notes="Welcome everyone. Today we're covering Q3 strategy, product milestones, and the go-to-market plan for Nexus Platform."
  >
    <TitleSlide
      title="Nexus Platform"
      subtitle="Q3 2026 Strategy & Product Update"
      tagline="Confidential"
      alignment="center"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.12 }}
    />
  </Slide>
);

// ─── Slide 2: Agenda ────────────────────────────────────────────────────────

const agendaSlide = (
  <Slide key="agenda" title="Agenda" scrollUnits={200}>
    <AgendaSlide
      title="Today's Agenda"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.08 }}
      items={[
        { label: 'Market Context', description: 'Competitive landscape & industry trends' },
        { label: 'Product Vision', description: 'Architecture & platform strategy' },
        { label: 'Platform Metrics', description: 'KPIs, traction & growth' },
        { label: 'Go-to-Market', description: 'Land, expand & revenue targets' },
        { label: 'Engineering Roadmap', description: 'Milestones through Q1 2027' },
        { label: 'Customer Case Study', description: 'Meridian Health migration' },
        { label: 'Q3 Priorities', description: 'Resource asks & next steps' },
      ]}
    />
  </Slide>
);

// ─── Slide 3: Section Divider — Market ──────────────────────────────────────

const marketSectionSlide = (
  <Slide key="section-market" title="Market Context" transition="push-left">
    <SectionSlide
      title="Market Context"
      subtitle="The data infrastructure inflection point"
      entrance={{ title: 'fadeIn', body: 'slideUp' }}
    />
  </Slide>
);

// ─── Slide 4: Market Context ────────────────────────────────────────────────

const marketSlide = (
  <Slide key="market" title="Market Context" scrollUnits={500}>
    <ContentSlide
      title="The Data Infrastructure Inflection Point"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}
    >
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
    </ContentSlide>
  </Slide>
);

// ─── Slide 5: Competitive Landscape ─────────────────────────────────────────

const competitiveLandscapeSlide = (
  <Slide key="competitive" title="Competitive Landscape" scrollUnits={400}>
    <ComparisonSlide
      title="Competitive Landscape"
      headers={['Legacy Platforms', 'Nexus Advantage']}
      highlightColumn={1}
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}
      rows={[
        {
          feature: 'Batch + Streaming',
          values: [
            { kind: 'text', value: 'Separate systems' },
            { kind: 'text', value: 'Unified engine' },
          ],
        },
        {
          feature: 'Multi-Cloud',
          values: [
            { kind: 'check', value: false },
            { kind: 'text', value: 'Zero-copy data mesh' },
          ],
        },
        {
          feature: 'Governance & Lineage',
          values: [
            { kind: 'text', value: 'Bolt-on' },
            { kind: 'text', value: 'Built-in from day one' },
          ],
        },
        {
          feature: 'Query Latency',
          values: [
            { kind: 'text', value: '2-5 seconds' },
            { kind: 'text', value: 'Sub-second at PB scale' },
          ],
        },
        {
          feature: 'ML Pipeline',
          values: [
            { kind: 'text', value: 'External tooling' },
            { kind: 'text', value: 'Native inference' },
          ],
        },
      ]}
    />
  </Slide>
);

// ─── Slide 6: Product Vision (Full-bleed) ───────────────────────────────────

const visionSlide = (
  <Slide
    key="vision"
    title="Product Vision"
    scrollUnits={200}
    transition="zoom-in"
    notes="This is our north star. Every feature decision ladders up to this vision."
  >
    <QuoteSlide
      quote="One platform for every data workload — from ingestion to insight."
      attribution="Nexus Platform"
      role="Product Vision"
      entrance={{ title: 'fadeIn' }}
    />
  </Slide>
);

// ─── Slide 7: Section Divider — Product ─────────────────────────────────────

const productSectionSlide = (
  <Slide key="section-product" title="Product & Architecture" transition="push-left">
    <SectionSlide
      title="Product & Architecture"
      subtitle="Platform design and technical depth"
    />
  </Slide>
);

// ─── Slide 8: Architecture (3D Diagram) ─────────────────────────────────────

const architectureSlide = (
  <Slide
    key="architecture"
    title="Platform Architecture"
    scrollUnits={300}
    sceneDsl={
      <>
        {sceneCamera}
        {sceneLighting}
        <Diagram id="arch-layers" x={0.08} y={0.05} w={0.84} h={0.9} tilt={-0.25}>
          <FlowLayout direction="top-down" gap={0.06} />

          <DiagramNode
            id="apps"
            label="Applications"
            sublabel="Analytics · Catalog · Lineage"
            shape="rectangle"
            icon="ui:squares-2x2"
            size={[0.15, 0.12]}
            thickness={0.030}
          />

          <DiagramNode
            id="api"
            label="API Gateway"
            sublabel="REST · gRPC · WebSocket"
            shape="hexagon"
            icon="net:internet"
            size={[0.18, 0.13]}
            thickness={0.030}
          />

          <DiagramGroup id="engine" label="Processing Engine" variant="container">
            <GridLayout columns={3} spacing={[0.04, 0.03]} />
            <DiagramNode
              id="stream"
              label="Stream"
              sublabel="Real-time"
              icon="data:stream"
              shape="circle"
              size={[0.13, 0.13]}
              thickness={0.030}
            />
            <DiagramNode
              id="batch"
              label="Batch"
              sublabel="Scheduled"
              icon="data:warehouse"
              shape="circle"
              size={[0.13, 0.13]}
              thickness={0.030}
            />
            <DiagramNode
              id="ml"
              label="ML Pipeline"
              sublabel="Inference"
              icon="ui:cpu-chip"
              shape="circle"
              size={[0.13, 0.13]}
              thickness={0.030}
            />
          </DiagramGroup>

          <DiagramNode
            id="storage"
            label="Storage Layer"
            sublabel="Columnar · Object Lake · KV"
            shape="octagon"
            icon="data:warehouse"
            size={[0.18, 0.13]}
            thickness={0.030}
          />

          <DiagramNode
            id="infra"
            label="Infrastructure"
            sublabel="Multi-Cloud · Auto-Scale"
            shape="rectangle"
            icon="security:shield"
            size={[0.15, 0.12]}
            thickness={0.030}
          />

          <DiagramEdge from="apps" to="api" routing="flow" flow="forward" />
          <DiagramEdge from="api" to="stream" routing="flow" flow="forward" />
          <DiagramEdge from="api" to="batch" routing="flow" flow="forward" />
          <DiagramEdge from="api" to="ml" routing="flow" flow="forward" />
          <DiagramEdge from="stream" to="storage" routing="flow" flow="forward" thickness={0.0105} />
          <DiagramEdge from="batch" to="storage" routing="flow" flow="forward" />
          <DiagramEdge from="ml" to="storage" routing="flow" flow="forward" />
          <DiagramEdge from="storage" to="infra" routing="flow" flow="forward" />
        </Diagram>
      </>
    }
  >
    <BlankSlide />
  </Slide>
);

// ─── Slide 9: Section Divider — Metrics ─────────────────────────────────────

const metricsSectionSlide = (
  <Slide key="section-metrics" title="Platform Metrics" transition="push-left">
    <SectionSlide
      title="Platform Metrics"
      subtitle="Traction, growth, and key performance indicators"
    />
  </Slide>
);

// ─── Slide 10: Big Number KPIs ──────────────────────────────────────────────

const kpiSlide = (
  <Slide key="kpis" title="Key Metrics" scrollUnits={200}>
    <BigNumberSlide
      title="Q2 2026 Performance"
      entrance={{ title: 'fadeIn', body: 'grow', stagger: 0.1 }}
      stats={[
        { value: '2.4M', label: 'Events / second', trend: '+34% QoQ', trendDirection: 'up' },
        { value: '847', label: 'Enterprise customers', trend: '+127 this quarter', trendDirection: 'up' },
        { value: '$68M', label: 'ARR', trend: '+42% YoY', trendDirection: 'up' },
        { value: '99.997%', label: 'Uptime (12mo)', trend: '5-nines target', trendDirection: 'up' },
      ]}
    />
  </Slide>
);

// ─── Slide 11: Platform Metrics with 3D Chart ──────────────────────────────

const metricsChartSlide = (
  <Slide
    key="metrics-chart"
    title="Revenue Growth"
    scrollUnits={300}
    sceneDsl={
      <>
        {sceneCamera}
        {sceneLighting}
        <View id="c1" x={0.52} y={0.1} w={0.44} h={0.8}>
          <BarChart
            id="metrics-chart"
            data={[
              { quarter: 'Q1', events: 1.2, customers: 580, arr: 38 },
              { quarter: 'Q2', events: 1.8, customers: 720, arr: 48 },
              { quarter: 'Q3', events: 2.1, customers: 790, arr: 58 },
              { quarter: 'Q4', events: 2.4, customers: 847, arr: 68 },
            ]}
            x={0.52}
            y={0.1}
            w={0.44}
            h={0.8}
            depth={0.4}
            animateEntry
          >
            <ChartData keyField="quarter" />
            <ChartAxis axis="x" field="quarter" label="Quarter" />
            <ChartAxis axis="y" field="arr" label="ARR ($M)" />
            <ChartSeries field="arr" label="ARR" />
            <ChartSeries field="events" label="Events/s (M)" />
            <ChartLegend visible position="right" />
          </BarChart>
        </View>
      </>
    }
  >
    <ContentSlide title="Revenue Trajectory">
      <Body>Key performance indicators through Q2 2026</Body>
      <Divider variant="gradient" />
      <MetricRow
        items={[
          { value: '$68M', label: 'ARR' },
          { value: '2.4M', label: 'Events/s' },
          { value: '847', label: 'Customers' },
        ]}
      />
    </ContentSlide>
  </Slide>
);

// ─── Slide 12: Performance Improvements ─────────────────────────────────────

const performanceSlide = (
  <Slide key="performance" title="Performance Gains" scrollUnits={300}>
    <ContentSlide
      title="v2.4 Performance Gains"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.08 }}
    >
      <Badge label="SHIPPED" variant="success" />
      <Divider variant="gradient" />
      <BulletList
        animateEntrance
        bulletStyle="checkmark"
        items={[
          'Cold query startup: 320ms → 45ms (∼7x improvement)',
          'Stream ingestion throughput: 1.8M → 2.4M events/s',
          'Cross-region replication lag: 850ms → 120ms',
          'Batch job P99 completion: 47 min → 12 min',
          'Concurrent query capacity: 2,400 → 8,100',
          'Memory footprint per node: 64 GB → 38 GB',
          'Time to first query (new tenant): 14 min → 90 sec',
        ]}
      />
      <Divider variant="gradient" />
      <QuoteBlock
        quote="The v2.4 cold start improvement alone saved us $1.2M in compute costs last month."
        attribution="Sarah Chen"
        role="VP Platform Engineering, Meridian Health"
      />
    </ContentSlide>
  </Slide>
);

// ─── Slide 13: Section Divider — GTM ────────────────────────────────────────

const gtmSectionSlide = (
  <Slide key="section-gtm" title="Go-to-Market" transition="push-left">
    <SectionSlide
      title="Go-to-Market Strategy"
      subtitle="Land, expand, and revenue targets"
    />
  </Slide>
);

// ─── Slide 14: Go-to-Market Strategy ────────────────────────────────────────

const gtmSlide = (
  <Slide key="gtm" title="Go-to-Market" scrollUnits={500}>
    <TwoColumnSlide
      title="Go-to-Market Strategy"
      entrance={{ left: 'slideLeft', right: 'slideRight', stagger: 0.15 }}
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
          <Divider variant="gradient" />
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
              '$68M ARR → $95M by end of Q4',
              'Net new logos: 200 enterprise accounts',
              'Land-to-expand conversion: 35% → 48%',
              'Average deal size: $82K → $110K',
            ]}
          />
          <Divider variant="gradient" />
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

// ─── Slide 15: Roadmap Timeline (3D Diagram) ───────────────────────────────

const roadmapSlide = (
  <Slide
    key="roadmap"
    title="Engineering Roadmap"
    scrollUnits={300}
    sceneDsl={
      <>
        {sceneCameraFlat}
        {sceneLighting}
        <Diagram id="roadmap-timeline" x={0.05} y={0.02} w={0.9} h={0.96} tilt={-0.25}>
          <FlowLayout direction="top-down" gap={0.08} />

          <DiagramNode
            id="q2"
            label="Q2 — v2.4"
            sublabel="Performance Release"
            shape="hexagon"
            icon="ui:cpu-chip"
            size={[0.40, 0.30]}
            glow={{ intensity: 0.2 }}
          />
          <DiagramNode
            id="q3"
            label="Q3 — v2.5"
            sublabel="Intelligence Layer"
            shape="hexagon"
            icon="ui:cpu-chip"
            size={[0.40, 0.30]}
          />
          <DiagramNode
            id="q4"
            label="Q4 — v3.0"
            sublabel="Data Mesh GA"
            shape="hexagon"
            icon="data:warehouse"
            size={[0.40, 0.30]}
          />
          <DiagramNode
            id="q1-27"
            label="Q1 '27 — v3.1"
            sublabel="Real-Time ML"
            shape="hexagon"
            icon="data:stream"
            size={[0.40, 0.30]}
          />

          <DiagramEdge from="q2" to="q3" routing="flow" flow="forward" />
          <DiagramEdge from="q3" to="q4" routing="flow" flow="forward" />
          <DiagramEdge from="q4" to="q1-27" routing="flow" flow="forward" />
        </Diagram>
      </>
    }
  >
    <BlankSlide />
  </Slide>
);

// ─── Slide 16: Case Study (3D Diagram + Content) ───────────────────────────

const caseStudySlide = (
  <Slide
    key="case-study"
    title="Case Study: Meridian Health"
    scrollUnits={500}
    notes="Meridian is our largest healthcare customer. They migrated from a Snowflake + Kafka + Airflow stack to Nexus in 4 months."
    sceneDsl={
      <>
        {sceneCamera}
        {sceneLighting}
        <Diagram id="case-study-migration" x={0.08} y={0.05} w={0.84} h={0.9} tilt={-0.25}>
          <FlowLayout direction="top-down" gap={0.12} />

          <DiagramGroup id="before" label="Before: 3 Separate Systems" variant="container">
            <GridLayout columns={3} spacing={[0.04, 0.02]} />
            <DiagramNode
              id="snowflake"
              label="Snowflake"
              sublabel="Analytics"
              icon="data:warehouse"
              shape="diamond"
              size={[0.15, 0.15]}
              thickness={0.030}
            />
            <DiagramNode
              id="kafka"
              label="Kafka"
              sublabel="Streaming"
              icon="data:stream"
              shape="diamond"
              size={[0.15, 0.15]}
              thickness={0.030}
            />
            <DiagramNode
              id="airflow"
              label="Airflow"
              sublabel="Orchestration"
              icon="ui:arrow-path"
              shape="diamond"
              size={[0.15, 0.15]}
              thickness={0.030}
            />
          </DiagramGroup>

          <DiagramNode
            id="nexus"
            label="Nexus Platform"
            sublabel="Unified Infrastructure"
            icon="ui:cpu-chip"
            shape="hexagon"
            size={[0.18, 0.18]}
            thickness={0.045}
            glow={{ intensity: 0.2 }}
          />

          <DiagramEdge from="snowflake" to="nexus" routing="flow" flow="forward" />
          <DiagramEdge from="kafka" to="nexus" routing="flow" flow="forward" />
          <DiagramEdge from="airflow" to="nexus" routing="flow" flow="forward" />
        </Diagram>
      </>
    }
  >
    <BlankSlide />
  </Slide>
);

// ─── Slide 17: Security & Compliance ────────────────────────────────────────

const securitySlide = (
  <Slide key="security" title="Security & Compliance" scrollUnits={400}>
    <TwoColumnSlide
      title="Security & Compliance"
      entrance={{ left: 'slideLeft', right: 'slideRight', stagger: 0.12 }}
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

// ─── Slide 18: Section Divider — Priorities ─────────────────────────────────

const prioritiesSectionSlide = (
  <Slide key="section-priorities" title="Q3 Priorities" transition="push-left">
    <SectionSlide
      title="Q3 Priorities"
      subtitle="What we need to deliver and what we need to get there"
    />
  </Slide>
);

// ─── Slide 19: Q3 Priorities ────────────────────────────────────────────────

const prioritiesSlide = (
  <Slide key="priorities" title="Q3 Priorities" scrollUnits={500}>
    <ContentSlide
      title="Q3 2026 Priorities"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.08 }}
    >
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
      <CalloutBox variant="info" title="Key Dependency">
        GPU cluster approval required by June 15 to hit Q3 ML inference targets.
      </CalloutBox>
    </ContentSlide>
  </Slide>
);

// ─── Slide 20: Resource Asks ────────────────────────────────────────────────

const resourceAskSlide = (
  <Slide key="resources" title="Resource Asks" scrollUnits={300}>
    <ContentSlide
      title="Resource Asks"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}
    >
      <Body>To hit our Q3 targets, we need approval on three investments.</Body>
      <Divider variant="gradient" />
      <ProcessSteps
        activeStep={0}
        steps={[
          {
            title: 'Headcount: +22 Engineers',
            description: 'ML/AI (8), query engine (6), platform (4), DevEx (4). $4.8M fully loaded.',
          },
          {
            title: 'Infrastructure: GPU Cluster',
            description: 'Dedicated A100 cluster for AI query optimization. 3-year reserved. $2.1M.',
          },
          {
            title: 'GTM: Sales Expansion',
            description: '6 AEs for healthcare + finserv. $800K developer marketing. $3.2M total.',
          },
        ]}
      />
      <Divider variant="gradient" />
      <MetricRow
        items={[
          { value: '$10.1M', label: 'Total Investment' },
          { value: '$95M', label: 'Projected Q4 ARR' },
          { value: '+40%', label: 'YoY Growth' },
        ]}
      />
    </ContentSlide>
  </Slide>
);

// ─── Slide 21: Customer Testimonial ─────────────────────────────────────────

const testimonialSlide = (
  <Slide key="testimonial" title="Customer Voice" transition="zoom-in">
    <QuoteSlide
      quote="Nexus eliminated three separate data systems and gave us real-time visibility we never had before. The migration paid for itself in the first quarter."
      attribution="Sarah Chen"
      role="VP Platform Engineering, Meridian Health"
      entrance={{ title: 'fadeIn' }}
    />
  </Slide>
);

// ─── Slide 22: Closing ──────────────────────────────────────────────────────

const closingSlide = (
  <Slide key="closing" title="Thank You" scrollUnits={100} transition="zoom-in">
    <TitleSlide
      title="Thank you."
      subtitle="Questions? Reach the Nexus team at platform@nexus.dev"
      tagline="Nexus Platform · Q3 2026 Strategy · Confidential"
      alignment="center"
      entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.15 }}
    />
  </Slide>
);

// ─── Exported slide array ───────────────────────────────────────────────────

export const demoSlides: ReactElement[] = [
  titleSlide,
  agendaSlide,
  // Section 1: Market
  marketSectionSlide,
  marketSlide,
  competitiveLandscapeSlide,
  visionSlide,
  // Section 2: Product
  productSectionSlide,
  architectureSlide,
  // Section 3: Metrics
  metricsSectionSlide,
  kpiSlide,
  metricsChartSlide,
  performanceSlide,
  // Section 4: GTM
  gtmSectionSlide,
  gtmSlide,
  roadmapSlide,
  caseStudySlide,
  securitySlide,
  // Section 5: Priorities
  prioritiesSectionSlide,
  prioritiesSlide,
  resourceAskSlide,
  testimonialSlide,
  closingSlide,
];
