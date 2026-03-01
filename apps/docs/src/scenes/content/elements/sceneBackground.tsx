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

function BackgroundContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Background</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>&lt;Background&gt;</code> element sets the scene background. Three variants are
        available: solid color, image, and gradient. Only one variant is active at a time.
      </p>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 10px' }}>Solid color</h2>
      <CodeBlock language="tsx" code={`<Background color="#0a0a14" />`} />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Image</h2>
      <CodeBlock
        language="tsx"
        code={`<Background
  imageUrl="/assets/bg-hero.jpg"
  opacity={1}
  cssSize="cover"
  cssPosition="center"
/>`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Gradient</h2>
      <CodeBlock
        language="tsx"
        code={`<Background gradient={{ from: '#0a0a14', to: '#1a1a2e', angle: 135 }} />`}
      />

      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', marginTop: 20 }}>
        The background interpolates smoothly between scenes — color values blend, opacity fades.
        Switching from a color to an image or gradient causes a crossfade rather than a snap.
      </p>
    </DocPanel>
  );
}

export function SceneBackground(): JSX.Element {
  return (
    <Scene key="scene-background" id="scene-background">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 2, 8]} target={[0, 1, 0]} fov={44} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.4} />
        <Directional color="#88ccff" intensity={1.6} position={[-1, 9, 5]} />
      </Lighting>

      <BackgroundContent />
    </Scene>
  );
}
