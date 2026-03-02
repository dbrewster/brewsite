import { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
} from '@brewsite/core';
import { DocPanel } from '../../../components/content/DocPanel';
import { CodeBlock } from '../../../components/ui/CodeBlock';

// Note: no ProgressManager on the last scene — no outgoing transition exists.
// The engine ignores scrollUnits on the last scene.

function TimelineContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Timeline &amp; Math</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Internal utilities for timeline algebra, progress mapping, and math helpers used by the
        compiler and runtime. Most users won't need these directly.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Easing functions</h2>
      <CodeBlock
        language="typescript"
        code={`import { TRANSITION_CROSSFADE, TRANSITION_SEQUENTIAL, easeOutCubic } from '@brewsite/core';

// Window presets: TRANSITION_CROSSFADE, TRANSITION_SEQUENTIAL,
// TRANSITION_EXIT_FIRST, TRANSITION_CUT

// Use on <Scene transition={TRANSITION_SEQUENTIAL} />
// Or inline: <Scene transition={{ exit: [0, 0.4], enter: [0.6, 1] }} />`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Blend utilities</h2>
      <CodeBlock
        language="typescript"
        code={`import { blendNumber, blendOpacity, blendVec3, blendColor, transitionT } from '@brewsite/core';

// Linear interpolation between two values
const t = 0.5;
const value = blendNumber(fromValue, toValue, t);

// For custom widgets: get the transition t for a frame
const progress = transitionT(frame, fromTick, toTick);`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Math utilities</h2>
      <CodeBlock
        language="typescript"
        code={`// Vec3 operations used in widget implementations
blendVec3([x1,y1,z1], [x2,y2,z2], t);  // lerp
blendColor('#ff0000', '#0000ff', t);    // hex color lerp`}
      />
    </DocPanel>
  );
}

export function SceneTimelineDocs(): JSX.Element {
  return (
    <Scene key="scene-timeline" id="scene-timeline">
      {/* No ProgressManager on the last scene — its scrollUnits would be ignored */}
      <Camera mode="world" position={[2, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#08100e" />
      <Lighting>
        <Ambient color="#44ff88" intensity={0.3} />
        <Directional color="#ccffaa" intensity={1.3} position={[4, 10, 3]} />
      </Lighting>

      <TimelineContent />
    </Scene>
  );
}
