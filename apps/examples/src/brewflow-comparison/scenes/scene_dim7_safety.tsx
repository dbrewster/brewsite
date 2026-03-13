import type {JSX} from 'react';
import {ProgressManager, Scene, TextBox,} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneDim7Safety = () => (
  <Scene key="bfc-dim7-safety" id="bfc-dim7-safety">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN}/>

    <Diagram id="safety-diagram" x={0} y={0} w={1} h={0.56} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
      <FlowLayout direction="left-right" gap={.05} />

      {/* Left — claude-flow TTL credentials */}
      <DiagramGroup id='g2' variant='container'>
        <FlowLayout direction="top-down" gap={1.05} />
        <DiagramNode id="safe-cf-creds" label="credentials namespace" sublabel="1-hour TTL · agent-responsible" size={[5.0, 1.55]} color="#1a1020"/>
        <DiagramNode id="safe-cf-gap" label="No classification pipeline" sublabel="no redaction · no sealed store · no read-time enforcement" size={[5.0, 1.55]}
                     color="#201010"/>
      </DiagramGroup>

      {/* Right — BrewFlow Sensitive Data Guard */}
      <DiagramGroup id='g1' variant='container'>
        <HierarchicalLayout spacing={[.5, 1.8]}/>
        <DiagramNode id="safe-bf-write" label="Every write boundary" sublabel="ingestion · consolidation · promotion · context assembly" size={[5.0, 1.55]}
                     color="#141830"/>
        <DiagramNode id="safe-bf-d1" label="allow_store" sublabel="safe as-is" size={[3.0, 1.55]} color="#0f2015"/>
        <DiagramNode id="safe-bf-d2" label="store_redacted" sublabel="placeholders replace content" size={[3.0, 1.55]} color="#1a1810"/>
        <DiagramNode id="safe-bf-d3" label="store_sealed" sublabel="audited vault · PHI default" size={[3.0, 1.55]}    color="#1a1015"/>
        <DiagramNode id="safe-bf-d4" label="no_store" sublabel="event logged · content withheld" size={[3.0, 1.55]}    color="#1a0f0f"/>
        <DiagramNode id="safe-bf-read" label="CensorCortex" sublabel="minimum-necessary · lane-scoped · audited seal reads" size={[3.0, 1.55]}
                     color="#1a1025" glow={{intensity: 0.1}}/>
      </DiagramGroup>
      <DiagramEdge from="safe-bf-write" to="safe-bf-d1" color="#6050a0" flow='forward'/>
      <DiagramEdge from="safe-bf-write" to="safe-bf-d2" color="#6050a0" flow='forward'/>
      <DiagramEdge from="safe-bf-write" to="safe-bf-d3" color="#6050a0" flow='forward'/>
      <DiagramEdge from="safe-bf-write" to="safe-bf-d4" color="#6050a0" flow='forward'/>
      <DiagramEdge from="safe-bf-d3" to="safe-bf-read" style="dashed" color="#6050a0"/>
    </Diagram>

    <TextBox id="dim7-prose" x={0} y={0.56} w={1} h={0.44}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          DIMENSION 7: SENSITIVE DATA
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px'}}>
          <div>
            <h3 style={{fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
              claude-flow: TTL credentials namespace
            </h3>
            <p style={{fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px'}}>
              claude-flow provides a credentials namespace with 1-hour TTL for storing
              sensitive values. The TTL limits exposure window if credentials leak. Beyond
              this, there is no classification pipeline: no automated redaction, no sealed
              store for PHI/PII, and no read-time enforcement preventing an agent from
              accessing data outside its scope. The agent is responsible for not misusing
              what it can access.
            </p>
          </div>
          <div>
            <h3 style={{fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600}}>
              BrewFlow: guard at every boundary
            </h3>
            <p style={{fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px'}}>
              BrewFlow's Sensitive Data Guard runs at every write boundary. Data is classified
              into one of four directives: allow_store (safe as-is), store_redacted
              (placeholders replace sensitive content), store_sealed (sealed vault, audited
              access, PHI/HIPAA default), or no_store (event logged, content withheld). At
              read time, CensorCortex enforces lane-scoped minimum-necessary access.
              Sealed vault reads require an audited access token.
            </p>
            <p style={{fontSize: 15, color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0}}>
              This is not relevant for most use cases. It becomes essential in regulated
              environments (healthcare, finance, legal) where audit trails for data access
              are required and unauthorized cross-lane access is a compliance violation.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
