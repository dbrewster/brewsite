import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  ProgressManager,
} from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';
import { DocPanel } from '../../../components/content/DocPanel';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { PropTable } from '../../../components/ui/PropTable';
import { Callout } from '../../../components/ui/Callout';

function HudAnimejsContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Anime.js Presets</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Import animation preset components from <code>@brewsite/core/hud/animejs</code> and wrap
        overlay content inside them. Presets trigger their animation when a scene enters.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { Fade, SlideUp, SlideDown, MidFade } from '@brewsite/core/hud/animejs';

<Scene key="hero">
  <Camera mode="world" position={[2, 1.5, 6]} target={[0, 1, 0]} />

  <Fade duration={600}>
    <div style={{ position: 'absolute', bottom: '8%', left: '6%' }}>
      <h1>Fades in when scene activates</h1>
    </div>
  </Fade>

  <SlideUp duration={500}>
    <div style={{ position: 'absolute', top: '6%', right: '6%' }}>
      <p>Slides up from below</p>
    </div>
  </SlideUp>
</Scene>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Available presets</h2>
      <PropTable
        rows={[
          { name: 'Fade',     type: 'component', description: 'Fade in from opacity 0 → 1 on scene enter' },
          { name: 'MidFade',  type: 'component', description: 'Fade via opacity 0 → 1 → 0 (enter and exit)' },
          { name: 'SlideUp',  type: 'component', description: 'Translate from +Y (below) to natural position' },
          { name: 'SlideDown',type: 'component', description: 'Translate from -Y (above) to natural position' },
          { name: 'ScrollOn', type: 'component', description: 'Reveal based on scene scroll progress' },
          { name: 'ScrollOff',type: 'component', description: 'Hide based on scene scroll progress' },
        ]}
      />

      <Callout type="note">
        All presets accept a <code>duration</code> prop (milliseconds). They use Anime.js under
        the hood and trigger on scene activation, not on scroll position.
      </Callout>
    </DocPanel>
  );
}

export function SceneHudAnimejs(): JSX.Element {
  return (
    <Scene key="scene-hud-animejs" id="scene-hud-animejs">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#140a0a" />
      <Lighting>
        <Ambient color="#ff4444" intensity={0.3} />
        <Directional color="#ffaa44" intensity={1.6} position={[4, 8, 3]} />
      </Lighting>

      <HudAnimejsContent />
    </Scene>
  );
}
