import type {JSX} from 'react';
import {Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene} from '@brewsite/core';
import {config} from "../../settings";
import {Lights} from "../../Lights";

export const sceneHero: JSX.Element = (
  <Scene key="bfc-hero" id="bfc-hero">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50} />
    <Lights/>
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
        MEMORY SYSTEMS COMPARED
      </div>
      <h1 style={{
        fontSize: 'clamp(1.89rem, 4.9vw, 3.5rem)',
        fontWeight: 700,
        color: '#e8f0ff',
        margin: '0 0 16px',
        lineHeight: 1.15,
      }}>
        claude-flow vs BrewFlow
      </h1>
      <p style={{
        fontSize: 'clamp(0.94rem, 2.2vw, 1.33rem)',
        color: 'rgba(180, 200, 240, 0.75)',
        margin: '0 0 32px',
        maxWidth: 600,
      }}>
        Eight dimensions. Two architectures. One honest trade-off.
      </p>
      <p style={{
        fontSize: 'clamp(0.89rem, 1.7vw, 1.11rem)',
        color: 'rgba(160, 180, 220, 0.65)',
        maxWidth: 700,
        lineHeight: 1.7,
        marginBottom: 20,
        textAlign: 'justify'
      }}>
        Both claude-flow and BrewFlow provide memory for multi-agent AI systems, but they
        make fundamentally different architectural choices. claude-flow builds memory on a
        SQLite blackboard with 12 tables, optimized for swarm coordination and simplicity.
        BrewFlow builds a four-layer pipeline inspired by Complementary Learning Systems
        theory, optimized for validated, long-term knowledge accumulation.
      </p>
      <p style={{
        fontSize: 'clamp(0.89rem, 1.7vw, 1.11rem)',
        color: 'rgba(160, 180, 220, 0.65)',
        maxWidth: 700,
        lineHeight: 1.7,
        textAlign: 'justify'
      }}>
        This document is an honest comparison — not a marketing document. Both systems have
        genuine strengths. The goal is to identify which trade-offs matter for which use
        cases, so practitioners can make informed choices rather than discovering the
        limitations after deployment.
      </p>
    </div>
  </Scene>
);
