import type {JSX} from 'react';
import {Background, Camera, Lighting, ProgressManager, Scene} from '@brewsite/core';
import {config} from "../../settings";

export const sceneHero: JSX.Element = (
  <Scene key="bfmu-hero" id="bfmu-hero">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50} />
    <Lighting/>
    <Background color="#080b14" />

    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      padding: '0 40px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.72rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase' as const,
        color: 'rgba(100, 140, 220, 0.7)',
        marginBottom: 16,
      }}>
        @BREWFLOW / CLOUD ARCHITECTURE
      </div>
      <h1 style={{
        fontSize: 'clamp(1.89rem, 4.9vw, 3.5rem)',
        fontWeight: 700,
        color: '#e8f0ff',
        margin: '0 0 16px',
        lineHeight: 1.15,
      }}>
        Memory at Scale
      </h1>
      <p style={{
        fontSize: 'clamp(0.94rem, 2.2vw, 1.33rem)',
        color: 'rgba(180, 200, 240, 0.75)',
        margin: '0 0 32px',
        textAlign: 'justify'
      }}>
        Multi-user partitioning. Expert debate extraction. Compounding shared knowledge.
      </p>
      <p style={{
        fontSize: 'clamp(0.89rem, 1.7vw, 1.11rem)',
        color: 'rgba(160, 180, 220, 0.65)',
        maxWidth: 720,
        lineHeight: 1.7,
        textAlign: 'justify'
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
  </Scene>
);
