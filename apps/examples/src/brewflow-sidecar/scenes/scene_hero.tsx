import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {Lights} from "../../Lights";
import {config} from "../../settings";

export const sceneHero: JSX.Element = (
  <Scene key="bf-hero" id="bf-hero">
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
        @BREWFLOW / HYPOTHESIS
      </div>
      <h1 style={{
        fontSize: 'clamp(1.89rem, 4.9vw, 3.5rem)',
        fontWeight: 700,
        color: '#e8f0ff',
        margin: '0 0 16px',
        lineHeight: 1.15,
      }}>
        BrewFlow Memory as a claude-flow Sidecar
      </h1>
      <p style={{
        fontSize: 'clamp(0.94rem, 2.2vw, 1.33rem)',
        color: 'rgba(180, 200, 240, 0.75)',
        margin: '0 0 32px',
        maxWidth: 600,
        textAlign: 'justify'
      }}>
        Three attachment surfaces. No code changes to claude-flow.
      </p>
      <p style={{
        fontSize: 'clamp(0.89rem, 1.7vw, 1.11rem)',
        color: 'rgba(160, 180, 220, 0.65)',
        maxWidth: 680,
        lineHeight: 1.7,
        textAlign: 'justify'
      }}>
        claude-flow is a multi-agent swarm orchestration framework that runs on top of Claude.
        It manages agent lifecycles, task assignment, shared memory via SQLite, and hook-driven
        automation. BrewFlow Memory is a standalone memory accumulation and recall system —
        episodic capture, LLM-driven consolidation, structured Neocortex recall. This document
        is a hypothesis: attach BrewFlow to a live claude-flow swarm as a passive sidecar
        using only public attachment points that claude-flow already provides.
      </p>
    </div>
  </Scene>
);
