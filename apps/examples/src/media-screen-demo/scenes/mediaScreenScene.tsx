// Single-scene DSL for the MediaScreen demo — three panels in a row.
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  TextBox,
  ViewLayout,
  View,
  InputController,
  Action,
  KeyMap,
} from '@brewsite/core';
import { MediaScreen } from '@brewsite/screens';

const CAROUSEL_ID = 'ms-carousel';

export const MediaScreenScene = (): JSX.Element => (
  <Scene id="ms-demo">
    <Camera mode="world" position={[0, 0.3, 5]} target={[0, 0, 0]} fov={50} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#1a1a40" />
      <Directional intensity={1.2} color="#8090ff" position={[0, 8, 10]} />
      <Directional intensity={0.5} color="#4060ff" position={[-6, 3, 8]} />
    </Lighting>
    <Background color="#06081a" />

    <InputController scope="window">
      <Action id="carousel-next" type="carousel.next" layoutId={CAROUSEL_ID} stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="carousel-prev" type="carousel.prev" layoutId={CAROUSEL_ID} stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout id={CAROUSEL_ID} kind="carousel">
      {/* Panel 1 — Video File */}
      <View id="view-video">
        <MediaScreen
          id="video-file"
          src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          autoPlay
          loop
          muted
          x={0.5}
          y={0.5}
          z={0}
          width={0.24}
          bezel="dark"
          bezelThickness={0.03}
          gloss={0.4}
          selfIllumination={0.8}
          glow
          glowColor="#4488ff"
          glowOpacity={0.3}
        />
      </View>

      {/* Panel 2 — Canvas Capture */}
      <View id="view-canvas">
        <MediaScreen
          id="canvas-demo"
          streamId="canvas-demo"
          x={0.5}
          y={0.5}
          z={0}
          width={0.24}
          bezel="dark"
          bezelThickness={0.03}
          gloss={0.4}
          selfIllumination={0.8}
          glow
          glowColor="#44ff88"
          glowOpacity={0.3}
        />
      </View>

      {/* Panel 3 — Display Capture */}
      <View id="view-display">
        <MediaScreen
          id="display-demo"
          streamId="display-demo"
          x={0.5}
          y={0.5}
          z={0}
          width={0.24}
          bezel="dark"
          bezelThickness={0.03}
          gloss={0.4}
          selfIllumination={0.8}
          glow
          glowColor="#ff6644"
          glowOpacity={0.3}
        />
      </View>
    </ViewLayout>

    {/* ── Key binding hint ────────────────────────────────────────────── */}
    <TextBox key="hint-keys" id="hint-keys" x={0.3} y={0.06} w={0.4} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12,
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 'clamp(10px, 1.1vw, 13px)', color: 'rgba(180, 200, 255, 0.55)' }}>
          <kbd style={{
            background: 'rgba(80, 120, 220, 0.15)',
            border: '1px solid rgba(100, 140, 255, 0.3)',
            borderRadius: 4,
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: '1.1em',
            color: 'rgba(160, 200, 255, 0.85)',
            marginRight: 4,
          }}>←</kbd>
          <kbd style={{
            background: 'rgba(80, 120, 220, 0.15)',
            border: '1px solid rgba(100, 140, 255, 0.3)',
            borderRadius: 4,
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: '1.1em',
            color: 'rgba(160, 200, 255, 0.85)',
            marginRight: 8,
          }}>→</kbd>
          Navigate panels
        </span>
      </div>
    </TextBox>

    {/* ── Labels under each screen ───────────────────────────────────── */}
    <TextBox key="label-video" id="label-video" x={0.1} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 180, 255, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Video File
        </span>
      </div>
    </TextBox>

    <TextBox key="label-canvas" id="label-canvas" x={0.4} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 255, 180, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Canvas Capture
        </span>
      </div>
    </TextBox>

    <TextBox key="label-display" id="label-display" x={0.7} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(255, 160, 130, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Display Capture
        </span>
      </div>
    </TextBox>
  </Scene>
);
