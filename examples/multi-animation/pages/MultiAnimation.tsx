import {ScenePlayer, useEngineState} from '@brewsite/core';
import type {JSX} from 'react';
import {useEffect, useState} from 'react';
import {createWidgetSetup} from '../widgetSetup';
import {scene01Intro} from '../scenes/scene01_intro';
import {scene02Arrival} from '../scenes/scene02_arrival';
import {scene03Reveal} from '../scenes/scene03_reveal';
import {scene04Scan} from '../scenes/scene04_scan';
import {scene05Outro} from '../scenes/scene05_outro';

const DebugHud = (): JSX.Element => {
  const state = useEngineState();
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 16,
        padding: '8px 10px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: 12,
        borderRadius: 6,
        pointerEvents: 'none',
      }}
    >
      <div>progress: {state.progress.toFixed(3)}</div>
      <div>sceneId: {state.sceneId || '(none)'}</div>
      <div>sceneIndex: {state.sceneIndex}</div>
      <div>sceneProgress: {state.sceneProgress.toFixed(3)}</div>
    </div>
  );
};

export default function MultiAnimation(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[ScenePlayer] error', error);
    }
  }, [error]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        .complex-hud {
          position: absolute;
          display: grid;
          gap: 12px;
          padding: 24px 28px;
          color: #e9f3ff;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(135deg, rgba(20, 32, 52, 0.65), rgba(38, 56, 90, 0.35));
          box-shadow: 0 24px 60px rgba(3, 10, 24, 0.45);
          backdrop-filter: blur(18px);
          pointer-events: none;
        }
        .complex-hud--bottom {
          left: 7vw;
          right: 7vw;
          bottom: 5vh;
          height: 40vh;
          max-height: 360px;
        }
        .complex-hud--right {
          top: 6vh;
          right: 5vw;
          width: min(38vw, 420px);
          height: 34vh;
          max-height: 320px;
        }
        .complex-hud__eyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: rgba(233, 243, 255, 0.6);
        }
        .complex-hud__title {
          font-size: 26px;
          font-weight: 600;
          margin: 0;
        }
        .complex-hud__body {
          font-size: 14px;
          line-height: 1.5;
          color: rgba(233, 243, 255, 0.8);
        }
        @media (max-width: 900px) {
          .complex-hud--bottom {
            left: 6vw;
            right: 6vw;
            height: 44vh;
          }
          .complex-hud--right {
            top: 4vh;
            right: 4vw;
            width: min(70vw, 420px);
          }
        }
      `}</style>
      <ScenePlayer
        sceneGroup={{
          id: 'complex',
          scenes: [scene01Intro, scene02Arrival, scene03Reveal, scene04Scan, scene05Outro],
        }}
        manifestUrl="/scene-manifest.json"
        widgetSetup={createWidgetSetup}
        framesPerTick={110}
        pixelsPerScene={1500}
        onError={(err) => setError(err)}
        placeholder={(
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div>
              <div>Loading scene…</div>
              {error && <div style={{ color: '#ffb3b3' }}>Error: {error.message}</div>}
            </div>
          </div>
        )}
      >
        <DebugHud />
      </ScenePlayer>
    </div>
  );
}
