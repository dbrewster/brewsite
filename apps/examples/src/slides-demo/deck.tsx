// apps/examples/src/slides-demo/deck.tsx
// "Nexus Platform — Q3 2026 Strategy & Product Update"
//
// Corporate deck following McKinsey action-title convention and SCR narrative:
//   Situation → Complication → Resolution → Evidence → Ask → Close
//
// Design principles applied:
//   • Action titles: every title is a complete sentence stating the takeaway
//   • One insight per slide: no information overload
//   • Diagrams placed alongside text in split layouts, not full-bleed
//   • Purpose-driven animation: only where it aids comprehension
//   • Section dividers for chapter structure with directional transitions

import type {ReactElement} from 'react';
import {
  AgendaSlide,
  Badge,
  BigNumberSlide,
  BulletList,
  CalloutBox,
  ComparisonSlide,
  ContentSlide,
  Divider,
  Heading,
  MetricRow,
  NumberedList,
  ProcessSteps,
  QuoteBlock,
  QuoteSlide,
  SectionSlide,
  Slide,
  Timeline,
  TitleSlide,
  TwoColumnSlide,
} from '@brewsite/slides';
import {Diagram, DiagramEdge, DiagramEnter, DiagramGroup, DiagramNode, FlowLayout, GridLayout,} from '@brewsite/diagram';
import {BarChart, ChartAxis, ChartData, ChartLegend, ChartSeries,} from '@brewsite/charts';

// ─── 1. TITLE ───────────────────────────────────────────────────────────────

const titleSlide = (
  <Slide
    key="title"
    title="Nexus Platform"
    scrollUnits={100}
    notes="Welcome. Today: Q3 strategy, product milestones, go-to-market, and resource asks."
  >
    <TitleSlide
      title="Nexus Platform"
      subtitle="Q3 2026 Strategy & Product Update"
      tagline="Confidential · Board Presentation"
      alignment="center"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.15}}
    />
  </Slide>
);

// ─── 2. AGENDA ──────────────────────────────────────────────────────────────

const agendaSlide = (
  <Slide key="agenda" title="Agenda" scrollUnits={200}>
    <AgendaSlide
      title="Today's Agenda"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.06}}
      items={[
        {label: 'Market Context', description: 'Why the window is now'},
        {label: 'Product & Architecture', description: 'What we built'},
        {label: 'Traction & Metrics', description: 'How it is performing'},
        {label: 'Go-to-Market', description: 'How we grow'},
        {label: 'Case Study', description: 'Meridian Health migration'},
        {label: 'Resource Ask', description: 'What we need'},
      ]}
    />
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 1: SITUATION — Market Context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionMarket = (
  <Slide key="section-market" transition="push-left">
    <SectionSlide title="Market Context" subtitle="The data infrastructure inflection point"/>
  </Slide>
);

const marketSlide = (
  <Slide
    key="market"
    title="The $47B data market is consolidating around platforms"
    scrollUnits={500}
  >
    <ContentSlide
      title="The $47B data market is consolidating around platforms"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.08}}
    >
      <BulletList
        animateEntrance
        bulletStyle="arrow"
        items={[
          'Enterprise data volumes growing 28% YoY — legacy ETL cannot keep pace',
          'Real-time analytics is table stakes: 73% of Fortune 500 rank it top-3',
          'Multi-cloud adoption accelerating — 67% of enterprises span 2+ providers',
          'Regulatory pressure (EU AI Act, DORA) demands full data lineage',
        ]}
      />
      <CalloutBox variant="info" title="Key Insight">
        Buyers want one platform, not five integrations. The consolidation window is 18–24 months.
      </CalloutBox>
    </ContentSlide>
  </Slide>
);

// ─── Competitive landscape ──────────────────────────────────────────────────

const competitiveSlide = (
  <Slide
    key="competitive"
    title="Legacy vendors solve one problem; Nexus solves the platform"
    scrollUnits={400}
  >
    <ComparisonSlide
      title="Legacy vendors solve one problem; Nexus solves the platform"
      headers={['Legacy Platforms', 'Nexus']}
      highlightColumn={1}
      entrance={{title: 'fadeIn', body: 'slideUp'}}
      rows={[
        {feature: 'Batch + Streaming', values: [{kind: 'text', value: 'Separate systems'}, {kind: 'text', value: 'Unified engine'}]},
        {feature: 'Multi-Cloud', values: [{kind: 'check', value: false}, {kind: 'text', value: 'Zero-copy mesh'}]},
        {feature: 'Governance', values: [{kind: 'text', value: 'Bolt-on'}, {kind: 'text', value: 'Built-in'}]},
        {feature: 'Query Latency', values: [{kind: 'text', value: '2–5 s'}, {kind: 'text', value: 'Sub-second'}]},
        {feature: 'ML Pipeline', values: [{kind: 'text', value: 'External'}, {kind: 'text', value: 'Native inference'}]},
      ]}
    />
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 2: RESOLUTION — Product & Architecture
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionProduct = (
  <Slide key="section-product" transition="push-left">
    <SectionSlide title="Product & Architecture" subtitle="One platform from ingestion to insight"/>
  </Slide>
);

// ─── Vision (quote) ─────────────────────────────────────────────────────────

const visionSlide = (
  <Slide
    key="vision"
    title="One platform for every data workload"
    scrollUnits={200}
    transition="zoom-in"
    notes="This is our north star. Every feature decision ladders up to this vision."
  >
    <QuoteSlide
      quote="One platform for every data workload — from ingestion to insight."
      attribution="Nexus Platform"
      role="Product Vision"
      entrance={{title: 'fadeIn'}}
    />
  </Slide>
);

// ─── Architecture diagram — right half, text on left ────────────────────────

const architectureSlide = (
  <Slide
    key="architecture"
    title="Five layers decouple applications from infrastructure"
    scrollUnits={400}
  >
    <TwoColumnSlide
      title="Five layers decouple applications from infrastructure"
      entrance={{left: 'slideLeft', right: 'fadeIn', stagger: 0.1}}
      left={
      <div style={{height: '100%', paddingTop: '20%'}}>
        <BulletList
          bulletStyle="arrow"
          items={[
            'Applications → API Gateway → Processing → Storage → Infrastructure',
            'Stream, batch, and ML run in a single engine — no external orchestration',
            'Storage layer abstracts columnar, object lake, and KV behind one API',
            'Infrastructure auto-scales across AWS, GCP, and Azure',
          ]}
        />
      </div>
      }
      right={
        <Diagram id="arch" tilt={"-0.22rad"}>
          <FlowLayout direction="top-down" gap={"7%"}/>
          <DiagramEnter fade/>

          <DiagramNode id="apps" label="Applications" sublabel="Analytics · Catalog · Lineage"
                       shape="square" icon="ui:squares-2x2" size={["15u", "15u"]} thickness={"2.5u"}/>

          <DiagramNode id="api" label="API Gateway" sublabel="REST · gRPC · WS"
                       shape="hexagon" icon="net:internet" size={["15u", "15u"]} thickness={"2.5u"}/>

          <DiagramGroup id="engine" label="Processing Engine" variant="container">
            <GridLayout columns={3} spacing={["15%", "0.5%"]}/>
            <DiagramNode id="stream" label="Stream" icon="data:stream" shape="circle" size={["14u", "14u"]} thickness={"2.5u"}/>
            <DiagramNode id="batch" label="Batch" icon="data:warehouse" shape="circle" size={["14u", "14u"]} thickness={"2.5u"}/>
            <DiagramNode id="ml" label="ML" icon="ui:cpu-chip" shape="circle" size={["14u", "14u"]} thickness={"2.5u"}/>
          </DiagramGroup>

          <DiagramNode id="storage" label="Storage" sublabel="Columnar · Object · KV"
                       shape="octagon" icon="data:warehouse" size={["15u", "15u"]} thickness={"2.5u"}/>

          <DiagramNode id="infra" label="Infrastructure" sublabel="Multi-Cloud"
                       shape="rectangle" icon="security:shield" size={["20u", "10u"]} thickness={"2.5u"}/>

          <DiagramEdge from="apps" to="api" routing="flow" flow="forward"/>
          <DiagramEdge from="api" to="stream" routing="flow" flow="forward"/>
          <DiagramEdge from="api" to="batch" routing="flow" flow="forward"/>
          <DiagramEdge from="api" to="ml" routing="flow" flow="forward"/>
          <DiagramEdge from="stream" to="storage" routing="flow" flow="forward"/>
          <DiagramEdge from="batch" to="storage" routing="flow" flow="forward"/>
          <DiagramEdge from="ml" to="storage" routing="flow" flow="forward"/>
          <DiagramEdge from="storage" to="infra" routing="flow" flow="forward"/>
        </Diagram>
      }
    />
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 3: EVIDENCE — Traction & Metrics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionMetrics = (
  <Slide key="section-metrics" transition="push-left">
    <SectionSlide title="Traction & Metrics" subtitle="Proof points through Q2 2026"/>
  </Slide>
);

// ─── KPI Big Numbers ────────────────────────────────────────────────────────

const kpiSlide = (
  <Slide
    key="kpis"
    title="Nexus crossed $68M ARR with 99.997% uptime"
    scrollUnits={200}
  >
    <BigNumberSlide
      title="Nexus crossed $68M ARR with 99.997% uptime"
      entrance={{title: 'fadeIn', body: 'grow', stagger: 0.1}}
      stats={[
        {value: '$68M', label: 'ARR', trend: '+42% YoY', trendDirection: 'up'},
        {value: '847', label: 'Enterprise Customers', trend: '+127 QoQ', trendDirection: 'up'},
        {value: '2.4M', label: 'Events / sec', trend: '+34% QoQ', trendDirection: 'up'},
        {value: '99.997%', label: 'Uptime (12 mo)', trend: 'Five-nines', trendDirection: 'up'},
      ]}
    />
  </Slide>
);

// ─── Revenue chart with text on left ────────────────────────────────────────

const revenueChartSlide = (
  <Slide
    key="revenue-chart"
    title="ARR grew 79% in four quarters driven by enterprise expansion"
    scrollUnits={300}
  >
    <TwoColumnSlide
      title="ARR grew 79% in four quarters driven by enterprise expansion"
      entrance={{left: 'slideLeft', right: 'fadeIn', stagger: 0.1}}
      left={
        <>
          <MetricRow
            items={[
              {value: '$38M', label: 'Q1'},
              {value: '$48M', label: 'Q2'},
              {value: '$58M', label: 'Q3'},
              {value: '$68M', label: 'Q4'},
            ]}
          />
          <Divider variant="gradient"/>
          <BulletList
            bulletStyle="arrow"
            items={[
              'Net new enterprise logos: 127 in Q2 alone',
              'Average deal size up 34% to $82K',
              'Net revenue retention: 138%',
            ]}
          />
        </>
      }
      right={
        <BarChart
          id="arr-chart"
          data={[
            {quarter: 'Q1', arr: 38},
            {quarter: 'Q2', arr: 48},
            {quarter: 'Q3', arr: 58},
            {quarter: 'Q4', arr: 68},
          ]}
          depth={0.35}
          animateEntry
        >
          <ChartData keyField="quarter"/>
          <ChartAxis axis="x" field="quarter" label="Quarter"/>
          <ChartAxis axis="y" field="arr" label="ARR ($M)"/>
          <ChartSeries field="arr" label="ARR ($M)"/>
          <ChartLegend visible={false}/>
        </BarChart>
      }
    />
  </Slide>
);

// ─── Performance gains ──────────────────────────────────────────────────────

const performanceSlide = (
  <Slide
    key="performance"
    title="v2.4 delivered 7× cold-start improvement and 40% memory reduction"
    scrollUnits={400}
  >
    <ContentSlide
      title="v2.4 delivered 7× cold-start improvement and 40% memory reduction"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.06}}
    >
      <Badge label="SHIPPED" variant="success"/>
      <BulletList
        animateEntrance
        bulletStyle="checkmark"
        items={[
          'Cold query startup: 320 ms → 45 ms (7× faster)',
          'Stream ingestion: 1.8 M → 2.4 M events/s (+33%)',
          'Cross-region replication lag: 850 ms → 120 ms',
          'Memory per node: 64 GB → 38 GB (−40%)',
          'Concurrent queries: 2,400 → 8,100 (3.4×)',
          'New-tenant first query: 14 min → 90 sec',
        ]}
      />
      <Divider variant="gradient"/>
      <QuoteBlock
        quote="The cold-start improvement alone saved us $1.2M in compute last month."
        attribution="Sarah Chen"
        role="VP Platform Engineering, Meridian Health"
      />
    </ContentSlide>
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 4: GROWTH — Go-to-Market & Roadmap
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionGrowth = (
  <Slide key="section-growth" transition="push-left">
    <SectionSlide title="Go-to-Market" subtitle="Land, expand, and revenue targets"/>
  </Slide>
);

// ─── GTM Strategy ───────────────────────────────────────────────────────────

const gtmSlide = (
  <Slide
    key="gtm"
    title="Free-tier onboarding converts to $110K average enterprise deals"
    scrollUnits={500}
  >
    <TwoColumnSlide
      title="Free-tier onboarding converts to $110K average enterprise deals"
      entrance={{left: 'slideLeft', right: 'slideRight', stagger: 0.12}}
      left={
        <>
          <Heading level={3}>Land</Heading>
          <BulletList
            animateEntrance
            bulletStyle="arrow"
            items={[
              'Free tier: 100 GB, 1 M events/day',
              'Self-serve onboarding in under 5 min',
              'Top-20 data source connectors included',
            ]}
          />
          <Divider variant="gradient"/>
          <Heading level={3}>Expand</Heading>
          <BulletList
            bulletStyle="arrow"
            items={[
              'Usage-based pricing, volume discounts',
              'Team features at 3+ seats',
              'Enterprise SSO/RBAC at $5 K/mo',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>Revenue Targets (Q4)</Heading>
          <NumberedList
            items={[
              'ARR: $68 M → $95 M',
              'New logos: 200 enterprise accounts',
              'L2E conversion: 35% → 48%',
              'Avg deal size: $82 K → $110 K',
            ]}
          />
          <Divider variant="gradient"/>
          <Heading level={3}>Key Bets</Heading>
          <BulletList
            bulletStyle="checkmark"
            items={[
              'AI query optimizer (Q3 ship)',
              'Pipeline marketplace',
              'SOC 2 II + HIPAA cert',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── Roadmap timeline — diagram right, text left ────────────────────────────

const roadmapSlide = (
  <Slide
    key="roadmap"
    title="Four releases take us from performance to real-time ML"
    scrollUnits={300}
  >
    <TwoColumnSlide
      title="Four releases take us from performance to real-time ML"
      entrance={{left: 'slideLeft', right: 'fadeIn', stagger: 0.1}}
      left={
        <Timeline
          orientation="vertical"
          items={[
            {label: 'v2.4', date: 'Q2 2026', description: 'Performance release — shipped', active: true},
            {label: 'v2.5', date: 'Q3 2026', description: 'AI query optimizer, anomaly detection'},
            {label: 'v3.0', date: 'Q4 2026', description: 'Data mesh GA, marketplace launch'},
            {label: 'v3.1', date: 'Q1 2027', description: 'Real-time ML inference pipeline'},
          ]}
        />
      }
      right={
        <Diagram id="roadmap" tilt={"-0.22rad"}>
          <FlowLayout direction="top-down" gap={"6%"}/>
          <DiagramEnter fade/>

          <DiagramNode id="q2" label="Q2 — v2.4" sublabel="Performance"
                       shape="hexagon" icon="ui:cpu-chip" size={["35u", "20u"]}
                       glow={{intensity: 0.15}}/>
          <DiagramNode id="q3" label="Q3 — v2.5" sublabel="Intelligence"
                       shape="hexagon" icon="ui:cpu-chip" size={["35u", "20u"]}/>
          <DiagramNode id="q4" label="Q4 — v3.0" sublabel="Data Mesh GA"
                       shape="hexagon" icon="data:warehouse" size={["35u", "20u"]}/>
          <DiagramNode id="q1-27" label="Q1 '27 — v3.1" sublabel="Real-Time ML"
                       shape="hexagon" icon="data:stream" size={["35u", "20u"]}/>

          <DiagramEdge from="q2" to="q3" routing="flow" flow="forward"/>
          <DiagramEdge from="q3" to="q4" routing="flow" flow="forward"/>
          <DiagramEdge from="q4" to="q1-27" routing="flow" flow="forward"/>
        </Diagram>
      }
    />
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 5: SOCIAL PROOF — Case Study
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionCaseStudy = (
  <Slide key="section-case" transition="push-left">
    <SectionSlide title="Case Study" subtitle="Meridian Health — from three systems to one"/>
  </Slide>
);

// ─── Case study with migration diagram on right ─────────────────────────────

const caseStudySlide = (
  <Slide
    key="case-study"
    title="Meridian replaced three systems with Nexus in four months"
    scrollUnits={400}
    notes="Meridian is our largest healthcare customer. Snowflake + Kafka + Airflow → Nexus in 4 months."
  >
    <TwoColumnSlide
      title="Meridian replaced three systems with Nexus in four months"
      entrance={{left: 'slideLeft', right: 'fadeIn', stagger: 0.1}}
      left={
        <>
          <BulletList
            bulletStyle="checkmark"
            items={[
              'Consolidated Snowflake + Kafka + Airflow into one platform',
              'Migration completed in 16 weeks with zero downtime',
              'Reduced infrastructure cost by $1.2 M/month',
              'Achieved real-time visibility for the first time',
            ]}
          />
          <Divider variant="gradient"/>
          <MetricRow
            items={[
              {value: '4 mo', label: 'Migration'},
              {value: '$1.2M', label: 'Monthly Savings'},
              {value: '3 → 1', label: 'Systems'},
            ]}
          />
        </>
      }
      right={
        <Diagram id="migration" tilt={"-0.22rad"}>
          <FlowLayout direction="top-down" gap={"10%"}/>
          <DiagramEnter fade/>

          <DiagramGroup id="before" label="Before" variant="container">
            <GridLayout columns={3} spacing={["3%", "2%"]}/>
            <DiagramNode id="sf" label="Snowflake" sublabel="Analytics"
                         icon="data:warehouse" shape="diamond" size={["12u", "12u"]} thickness={"2.5u"}/>
            <DiagramNode id="kafka" label="Kafka" sublabel="Streaming"
                         icon="data:stream" shape="diamond" size={["12u", "12u"]} thickness={"2.5u"}/>
            <DiagramNode id="airflow" label="Airflow" sublabel="Orchestration"
                         icon="ui:arrow-path" shape="diamond" size={["12u", "12u"]} thickness={"2.5u"}/>
          </DiagramGroup>

          <DiagramNode id="nexus" label="Nexus" sublabel="Unified Platform"
                       icon="ui:cpu-chip" shape="hexagon" size={["16u", "16u"]} thickness={"4u"}
                       glow={{intensity: 0.15}}/>

          <DiagramEdge from="sf" to="nexus" routing="flow" flow="forward"/>
          <DiagramEdge from="kafka" to="nexus" routing="flow" flow="forward"/>
          <DiagramEdge from="airflow" to="nexus" routing="flow" flow="forward"/>
        </Diagram>
      }
    />
  </Slide>
);

// ─── Customer testimonial ───────────────────────────────────────────────────

const testimonialSlide = (
  <Slide key="testimonial" transition="zoom-in">
    <QuoteSlide
      quote="Nexus eliminated three separate data systems and gave us real-time visibility we never had. The migration paid for itself in the first quarter."
      attribution="Sarah Chen"
      role="VP Platform Engineering, Meridian Health"
      entrance={{title: 'fadeIn'}}
    />
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SECTION 6: ASK — Security, Priorities, Resources
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sectionAsk = (
  <Slide key="section-ask" transition="push-left">
    <SectionSlide title="Q3 Priorities & Ask" subtitle="What we need to capture the window"/>
  </Slide>
);

// ─── Security & Compliance ──────────────────────────────────────────────────

const securitySlide = (
  <Slide
    key="security"
    title="Enterprise-grade security is already in place"
    scrollUnits={300}
  >
    <TwoColumnSlide
      title="Enterprise-grade security is already in place"
      entrance={{left: 'slideLeft', right: 'slideRight', stagger: 0.1}}
      left={
        <>
          <Heading level={3}>Certifications</Heading>
          <BulletList
            bulletStyle="checkmark"
            items={[
              'SOC 2 Type II (since 2024)',
              'ISO 27001 certified',
              'HIPAA BAA available',
              'GDPR data residency',
              'FedRAMP Moderate (in progress)',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>Architecture</Heading>
          <BulletList
            bulletStyle="arrow"
            items={[
              'AES-256 at rest, TLS 1.3 in transit',
              'Customer-managed KMS keys',
              'Row-level security with ABAC',
              'Full audit log, 7-year retention',
              'Zero-trust mTLS service mesh',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── Q3 Priorities ──────────────────────────────────────────────────────────

const prioritiesSlide = (
  <Slide
    key="priorities"
    title="Six priorities define Q3 success"
    scrollUnits={500}
  >
    <ContentSlide
      title="Six priorities define Q3 success"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.06}}
    >
      <NumberedList
        animateEntrance
        items={[
          'Ship v2.5 Intelligence Layer: AI query optimizer, anomaly detection, auto-schema',
          'Close 50+ enterprise deals in healthcare and finserv verticals',
          'Launch self-serve pipeline marketplace with 20 pre-built connectors',
          'Complete SOC 2 re-cert and submit FedRAMP Moderate application',
          'Hire 22 engineers: 8 ML/AI, 6 query engine, 4 platform, 4 DevEx',
          'Cut median time-to-value from 14 days to 5 days',
        ]}
      />
    </ContentSlide>
  </Slide>
);

// ─── Resource Ask ───────────────────────────────────────────────────────────

const resourceAskSlide = (
  <Slide
    key="resources"
    title="$10.1M investment unlocks $95M ARR by Q4"
    scrollUnits={300}
  >
    <ContentSlide
      title="$10.1M investment unlocks $95M ARR by Q4"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.08}}
    >
      <ProcessSteps
        activeStep={0}
        steps={[
          {title: '01 — Headcount (+22 engineers)', description: 'ML/AI 8, query engine 6, platform 4, DevEx 4. $4.8M fully loaded.'},
          {title: '02 — GPU Cluster', description: 'Dedicated A100s for AI query optimization. 3-year reserved. $2.1M.'},
          {title: '03 — Sales Expansion', description: '6 AEs for healthcare + finserv. $800K dev marketing. $3.2M total.'},
        ]}
      />
      <Divider variant="gradient"/>
      <MetricRow
        items={[
          {value: '$10.1M', label: 'Total Ask'},
          {value: '$95M', label: 'Q4 ARR Target'},
          {value: '+40%', label: 'YoY Growth'},
        ]}
      />
      <CalloutBox variant="warning" title="Timeline">
        GPU cluster approval needed by June 15 to meet Q3 ML inference milestones.
      </CalloutBox>
    </ContentSlide>
  </Slide>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CLOSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const closingSlide = (
  <Slide key="closing" scrollUnits={100} transition="zoom-in">
    <TitleSlide
      title="Thank you."
      subtitle="Questions? platform@nexus.dev"
      tagline="Nexus Platform · Q3 2026 Strategy · Confidential"
      alignment="center"
      entrance={{title: 'fadeIn', body: 'slideUp', stagger: 0.15}}
    />
  </Slide>
);

// ─── Exported slide array ───────────────────────────────────────────────────

export const demoSlides: ReactElement[] = [
  // Opening
  titleSlide,
  agendaSlide,

  // Section 1: Situation — Market
  sectionMarket,
  marketSlide,
  competitiveSlide,

  // Section 2: Resolution — Product
  sectionProduct,
  visionSlide,
  architectureSlide,

  // Section 3: Evidence — Metrics
  sectionMetrics,
  kpiSlide,
  revenueChartSlide,
  performanceSlide,

  // Section 4: Growth — GTM & Roadmap
  sectionGrowth,
  gtmSlide,
  roadmapSlide,

  // Section 5: Social Proof
  sectionCaseStudy,
  caseStudySlide,
  testimonialSlide,

  // Section 6: Ask
  sectionAsk,
  securitySlide,
  prioritiesSlide,
  resourceAskSlide,

  // Close
  closingSlide,
];
