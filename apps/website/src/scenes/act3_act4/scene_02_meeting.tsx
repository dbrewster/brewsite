import type { JSX } from 'react';
import { Scene, ProgressManager } from '@brewsite/core';
import {actorElements} from "./meetingCharacters";
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

const snippetCode = `{actors.map((a) => (
  <Model key={a.id} type={a.type}
    id={a.id} x={a.x} y={a.y} w={0.08} h={0.15} scale={0.001}>
    <Playback>
      <Animation clipName={a.clip} weight={1} />
    </Playback>
  </Model>
))}`;

// Camera, lighting, floor, and crowd actors all carry forward from scene01ModelWide.
// Only the progress budget and overlay text change here.
export const scene02Meeting: JSX.Element = (
  <Scene id="website-meeting-01" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={2000}
      fn={dwellFn}
      autoAdvance={{ duration: 8, max: 0.85, pauseOnScroll: true }}
      animationTimeScale={2}
    />

    <div key="meeting-overlay" style={{
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: '36%',
      padding: '20px 40px',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(4,8,18,0.2) 0%, rgba(4,8,18,0.95) 100%)',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: 560 }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(0,245,255,0.6)',
          marginBottom: 10,
        }}>
          Procedural Composition
        </div>
        <div style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 700, color: '#f0f6fc', marginBottom: 12 }}>
          30 characters.<br />50 lines of JSX.
        </div>
        <pre style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 'clamp(11px, 1.2vw, 13px)',
          lineHeight: 1.7,
          color: '#00f5ff',
          background: 'rgba(0,245,255,0.04)',
          border: '1px solid rgba(0,245,255,0.15)',
          borderRadius: 6,
          padding: 16,
          maxWidth: 400,
          margin: '0 0 12px',
          whiteSpace: 'pre-wrap',
        }}>
          {snippetCode}
        </pre>
        <div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
          Placement. Collision detection. Animation assignment.<br />
          All at author time. Runtime is just playback.
        </div>
      </div>
    </div>

    {actorElements}
  </Scene>
);
