// MediaScreen Demo — demonstrates all three MediaScreen source modes.
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import {
  BackgroundLayer,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type ThemeFamily,
  type ThemePolarity,
  type ActiveTheme,
} from '@brewsite/core';
import { useDisplayCapture } from '@brewsite/screens';
import { createMediaScreenDemoPlugins } from './widgetSetup';
import { MediaScreenScene } from './scenes/mediaScreenScene';
import { CanvasAnimation } from './CanvasAnimation';
import { ThemeToggle } from '../Lights';

// ── Display capture controls (must be inside SceneEngine for hook access) ────

function DisplayCaptureControls(): JSX.Element {
  const { startCapture, stopCapture, isCapturing, error } = useDisplayCapture(
    'display-demo',
    { displaySurface: 'browser', frameRate: 30 },
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        right: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        zIndex: 10,
      }}
    >
      {!isCapturing ? (
        <button
          type="button"
          onClick={() => void startCapture()}
          style={{
            padding: '10px 20px',
            background: 'rgba(255, 100, 68, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255, 140, 100, 0.6)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(8px)',
          }}
        >
          Start Screen Capture
        </button>
      ) : (
        <button
          type="button"
          onClick={stopCapture}
          style={{
            padding: '10px 20px',
            background: 'rgba(60, 60, 80, 0.85)',
            color: '#fff',
            border: '1px solid rgba(120, 120, 150, 0.5)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(8px)',
          }}
        >
          Stop Capture
        </button>
      )}
      {error && (
        <div
          style={{
            padding: '6px 12px',
            background: 'rgba(200, 40, 40, 0.8)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 11,
            maxWidth: 260,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {error.message}
        </div>
      )}
    </div>
  );
}

// ── Title overlay ────────────────────────────────────────────────────────────

function TitleOverlay(): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(14px, 2vw, 20px)',
          fontWeight: 600,
          color: 'rgba(200, 220, 255, 0.85)',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          letterSpacing: '0.04em',
        }}
      >
        MediaScreen Demo
      </h1>
      <p
        style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 170, 200, 0.6)',
          fontFamily: 'JetBrains Mono, monospace',
          margin: '4px 0 0',
        }}
      >
        @brewsite/screens
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MediaScreenDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createMediaScreenDemoPlugins(), []);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: '#06081a' }}>
      <ThemeToggle
        onPolarityChange={setPolarity}
        onFamilyChange={setFamily}
        persist
      />
      <SceneEngine plugins={plugins} theme={theme}>
        {/* Scene declaration */}
        <MediaScreenScene />

        {/* Canvas + scroll layout */}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={100}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents />
          <InputCoordinator />
        </ScrollStage>

        {/* Hidden canvas for Panel 2 — stream registered via captureCanvasStream */}
        <CanvasAnimation />

        {/* HTML overlays — positioned over the 3D canvas */}
        <TitleOverlay />
        <DisplayCaptureControls />
      </SceneEngine>
    </div>
  );
}
