import type {JSX} from 'react';
import {Background, Camera, Floor, ProgressManager, Scene, TextBox} from '@brewsite/core';
import {Lights} from "../../Lights";

export const sceneHero: JSX.Element = (
  <Scene key="bfc-hero" id="bfc-hero">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={[0, 1, 60]} target={[0, 1.5, 0]} fov={40} />
    <Lights/>
    <Background color="#080b14" />
    <Floor enabled={false}/>

    <TextBox id="hero-content" x={0.06} y={0.08} w={0.88} h={0.84}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        padding: '0 40px',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          MEMORY SYSTEMS COMPARED
        </div>
        <h1 style={{
          fontSize: 56,
          fontWeight: 700,
          color: '#e8f0ff',
          margin: '0 0 16px',
          lineHeight: 1.15,
        }}>
          claude-flow vs BrewFlow
        </h1>
        <p style={{
          fontSize: 22,
          color: 'rgba(180, 200, 240, 0.75)',
          margin: '0 0 32px',
          maxWidth: 600,
        }}>
          Eight dimensions. Two architectures. One honest trade-off.
        </p>
        <p style={{
          fontSize: 18,
          color: 'rgba(160, 180, 220, 0.65)',
          maxWidth: 700,
          lineHeight: 1.7,
          marginBottom: 20,
          textAlign: 'justify',
        }}>
          Both claude-flow and BrewFlow provide memory for multi-agent AI systems, but they
          make fundamentally different architectural choices. claude-flow builds memory on a
          SQLite blackboard with 12 tables, optimized for swarm coordination and simplicity.
          BrewFlow builds a four-layer pipeline inspired by Complementary Learning Systems
          theory, optimized for validated, long-term knowledge accumulation.
        </p>
        <p style={{
          fontSize: 18,
          color: 'rgba(160, 180, 220, 0.65)',
          maxWidth: 700,
          lineHeight: 1.7,
          textAlign: 'justify',
        }}>
          This document is an honest comparison — not a marketing document. Both systems have
          genuine strengths. The goal is to identify which trade-offs matter for which use
          cases, so practitioners can make informed choices rather than discovering the
          limitations after deployment.
        </p>
      </div>
    </TextBox>
  </Scene>
);
