import type {JSX} from 'react';
import {Background, Camera, ProgressManager, Scene} from '@brewsite/core';
import {Lights} from "../../Lights";
import { TextBox } from "@brewsite/core";

export const sceneHero: JSX.Element = (
  <Scene key="bf-hero" id="bf-hero">
    <ProgressManager scrollUnits={1600} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0.5, 0]} fov={50} />
    <Lights/>
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
          @BREWFLOW / HYPOTHESIS
        </div>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 700,
          color: '#e8f0ff',
          margin: '0 0 16px',
          lineHeight: 1.15,
        }}>
          BrewFlow Memory as a claude-flow Sidecar
        </h1>
        <p style={{
          fontSize: '22px',
          color: 'rgba(180, 200, 240, 0.75)',
          margin: '0 0 32px',
          maxWidth: 600,
          textAlign: 'justify',
        }}>
          Three attachment surfaces. No code changes to claude-flow.
        </p>
        <p style={{
          fontSize: '18px',
          color: 'rgba(160, 180, 220, 0.65)',
          maxWidth: 680,
          lineHeight: 1.7,
          textAlign: 'justify',
        }}>
          claude-flow is a multi-agent swarm orchestration framework that runs on top of Claude.
          It manages agent lifecycles, task assignment, shared memory via SQLite, and hook-driven
          automation. BrewFlow Memory is a standalone memory accumulation and recall system —
          episodic capture, LLM-driven consolidation, structured Neocortex recall. This document
          is a hypothesis: attach BrewFlow to a live claude-flow swarm as a passive sidecar
          using only public attachment points that claude-flow already provides.
        </p>
      </div>
    </TextBox>
  </Scene>
);
