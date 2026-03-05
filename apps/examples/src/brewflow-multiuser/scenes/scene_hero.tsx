import type {JSX} from 'react';
import {Background, Camera, Lighting, ProgressManager, Scene, TextBox} from '@brewsite/core';

export const sceneHero: JSX.Element = (
  <Scene key="bfmu-hero" id="bfmu-hero">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50} />
    <Lighting/>
    <Background color="#080b14" />

    <TextBox id="hero-content" x={0.05} y={0.08} w={0.9} h={0.84}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        pointerEvents: 'none',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          @BREWFLOW / CLOUD ARCHITECTURE
        </div>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 700,
          color: '#e8f0ff',
          margin: '0 0 16px',
          lineHeight: 1.15,
        }}>
          Memory at Scale
        </h1>
        <p style={{
          fontSize: '22px',
          color: 'rgba(180, 200, 240, 0.75)',
          margin: '0 0 32px',
          textAlign: 'justify',
        }}>
          Multi-user partitioning. Expert debate extraction. Compounding shared knowledge.
        </p>
        <p style={{
          fontSize: '18px',
          color: 'rgba(160, 180, 220, 0.65)',
          maxWidth: 720,
          lineHeight: 1.7,
          textAlign: 'justify',
        }}>
          The single-user sidecar model breaks the moment a second user arrives. Two users writing
          the same episodic store corrupt each other's event lineage. Two dreamers racing to update
          the Neocortex produce last-writer-wins chaos. The cloud architecture solves this with
          identity-keyed partitioning, a serialized promotion queue, and three Neocortex planes with
          escalating evidence thresholds. Expert debate extraction — five independent specialist LLMs
          arguing until they agree — adds a new layer of rigor inside each user's dreamer, making
          the knowledge that reaches shared project-scope genuinely trustworthy.
        </p>
      </div>
    </TextBox>
  </Scene>
);
