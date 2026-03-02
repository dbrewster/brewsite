import type { JSX } from 'react';
import { Scene, ProgressManager } from '@brewsite/core';
import { MidFade } from '@brewsite/core/hud/animejs';
import {actorElements} from "./meetingCharacters";
import { dwellFn } from '../../utils/pacing';

const LATE_FADE = { exit: [1.0, 1.0] as [number, number], enter: [1.0, 1.0] as [number, number] };

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

    <div style={{
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: '28%',
      padding: '20px 40px',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(4,8,18,0.2) 0%, rgba(4,8,18,0.95) 100%)',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: 560 }}>
        <MidFade duration={1400}>
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
          <div style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 700, color: '#f0f6fc', marginBottom: 10 }}>
            30 characters. 50 lines of JSX.
          </div>
          <div style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: 'rgba(240,246,252,0.65)', lineHeight: 1.6 }}>
            Random placement, collision detection, animation assignment — all at
            author time. Runtime is just playback.
          </div>
        </MidFade>
      </div>
    </div>

    {actorElements}
  </Scene>
);
