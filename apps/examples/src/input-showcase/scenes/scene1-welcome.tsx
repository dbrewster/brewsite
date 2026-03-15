// Scene 1: Welcome — hero title + grid of scene cards.
// Demonstrates basic scene.next / scene.prev scene navigation.
import type { JSX } from 'react';
import {
  Action,
  Ambient,
  Camera,
  Directional,
  Floor,
  formatModifier,
  InputController,
  KeyMap,
  Lighting,
  PinchMap,
  PointerMap,
  ProgressManager,
  Scene,
  TextBox,
  WheelMap,
} from '@brewsite/core';

const CAM_POS: [number, number, number] = [0, 2.5, 9];
const CAM_TGT: [number, number, number] = [0, 0, 0];

interface SceneCard {
  num: number;
  title: string;
  desc: string;
}

const SCENE_CARDS: SceneCard[] = [
  { num: 2, title: 'Camera Controls', desc: 'Orbit, dolly, and reset bindings — drag, wheel, pinch, and keyboard.' },
  { num: 3, title: 'Scene Navigation', desc: 'Arrow keys, click, scroll, and multi-step scene jumping (stepScenes).' },
  { num: 4, title: 'Ring Carousel', desc: 'Scroll X / swipe horizontally to rotate. → or Click to advance. ← to go back.' },
  { num: 5, title: 'Linear Carousel', desc: `Scroll X / swipe horizontally to move. → or Space jumps 2. ${formatModifier('shift')}+→ moves 1.` },
  { num: 6, title: 'Scrollable Text', desc: `TextBox with overflowY:auto inner div. ${formatModifier('ctrl')}+Scroll reserved for zoom.` },
  { num: 7, title: 'All Input Maps', desc: 'scope="window" + every map type, all modifier combos, and multi-step actions.' },
];

export const WelcomeScene = (): JSX.Element => (
  <Scene id="input-welcome">
    <ProgressManager scrollUnits={700} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={52} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.55} color="#d7e8ff" />
      <Directional intensity={1.3} color="#b0ccff" position={[-4, 8, 10]} />
      <Directional intensity={0.9} color="#ffd8b0" position={[6, 5, 8]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    <InputController scope="canvas">
      <Action id="scene-next" type="scene.next">
        <KeyMap keyName="ArrowDown" />
        <PointerMap event="click" />
        <WheelMap axis="y" />
      </Action>
      <Action id="scene-prev" type="scene.prev">
        <KeyMap keyName="ArrowUp" />
      </Action>
      <Action id="dolly" type="camera.zoom">
        <PinchMap direction="both" threshold={1} />
      </Action>
    </InputController>

    {/* Hero title bar */}
    <TextBox id="welcome-title" x={0.05} y={0.07} w={0.82} h={0.17} layer={2}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 24px',
          background: 'rgba(4, 12, 28, 0.85)',
          backdropFilter: 'blur(14px)',
          borderRadius: 12,
          border: '1px solid rgba(70, 130, 220, 0.3)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(140,180,255,0.7)', marginBottom: 4 }}>
          BrewSite Examples
        </div>
        <h1 style={{ margin: 0, fontSize: 'clamp(16px, 2.3vw, 28px)', fontWeight: 700, color: '#e0eaff', lineHeight: 1.2 }}>
          Input Options Showcase
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 'clamp(10px, 1.1vw, 13px)', color: 'rgba(180,210,255,0.75)' }}>
          Every InputController, Action, PointerMap, WheelMap, PinchMap, and KeyMap option — demonstrated scene by scene.
        </p>
      </div>
    </TextBox>

    {/* Scene cards grid */}
    <TextBox id="welcome-cards" x={0.05} y={0.27} w={0.82} h={0.61} layer={2}>
      <style>{`
        .welcome-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(3, 1fr);
          gap: 8px;
        }
        @media (max-width: 540px) {
          .welcome-cards-grid {
            grid-template-columns: 1fr;
            grid-template-rows: none;
          }
        }
      `}</style>
      <div
        style={{
          height: '100%',
          padding: '12px',
          background: 'rgba(4, 12, 28, 0.82)',
          backdropFilter: 'blur(14px)',
          borderRadius: 12,
          border: '1px solid rgba(70, 130, 220, 0.25)',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div className="welcome-cards-grid" style={{ height: '100%' }}>
          {SCENE_CARDS.map((card) => (
            <div
              key={card.num}
              style={{
                background: 'rgba(20, 40, 80, 0.6)',
                borderRadius: 8,
                border: '1px solid rgba(70, 130, 220, 0.2)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'rgba(80, 144, 224, 0.3)',
                    border: '1px solid rgba(80, 144, 224, 0.5)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#7ab4ff',
                    flexShrink: 0,
                  }}
                >
                  {card.num}
                </span>
                <span style={{ fontSize: 'clamp(10px, 1.1vw, 13px)', fontWeight: 600, color: '#c8deff' }}>{card.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: 'clamp(9px, 0.9vw, 11px)', color: 'rgba(160, 200, 255, 0.7)', lineHeight: 1.5 }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </TextBox>

    {/* Navigation hint */}
    <TextBox id="welcome-hint" x={0.22} y={0.90} w={0.44} h={0.06} layer={2}>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(120,160,220,0.6)' }}>
        Press <kbd style={{ background: 'rgba(80,144,224,0.2)', border: '1px solid rgba(80,144,224,0.4)', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13 }}>↓</kbd>{' '}
        or <kbd style={{ background: 'rgba(80,144,224,0.2)', border: '1px solid rgba(80,144,224,0.4)', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13 }}>Click</kbd>{' '}
        or scroll / swipe to advance
      </div>
    </TextBox>
  </Scene>
);
