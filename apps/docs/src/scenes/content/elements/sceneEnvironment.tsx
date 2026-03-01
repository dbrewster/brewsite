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
import { Callout } from '../../../components/ui/Callout';

function EnvironmentContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>Environment</h1>
      <p style={{ fontSize: 'var(--font-size-base)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        The <code>&lt;Environment&gt;</code> element sets an HDR cube map used for image-based
        lighting (IBL) and reflections on metallic surfaces. It takes an{' '}
        <code>&lt;EnvironmentCube&gt;</code> child with six face URLs.
      </p>

      <CodeBlock
        language="tsx"
        code={`<Environment enabled intensity={0.15}>
  <EnvironmentCube urls={[
    '/env/px.jpg', '/env/nx.jpg',
    '/env/py.jpg', '/env/ny.jpg',
    '/env/pz.jpg', '/env/nz.jpg',
  ]} />
</Environment>`}
      />

      <Callout type="note">
        The <code>urls</code> array order is <code>[+x, -x, +y, -y, +z, -z]</code> cube faces.
        Use HDR-derived cube maps for best results — low <code>intensity</code> values (0.1–0.3)
        add subtle metallic reflections without overpowering your lighting rig.
      </Callout>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 10px' }}>Props</h2>
      <CodeBlock
        language="tsx"
        code={`// Enable/disable the environment map
<Environment enabled={true} intensity={0.15}>
  ...
</Environment>

// Disable — clear reflections
<Environment enabled={false}>
  ...
</Environment>`}
      />
    </DocPanel>
  );
}

export function SceneEnvironment(): JSX.Element {
  return (
    <Scene key="scene-environment" id="scene-environment">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="orbit" target={[0, 0, 0]} azimuth={0.3} polar={1.1} distance={8} />
      <Background color="#0a1220" />
      <Lighting>
        <Ambient color="#2244ff" intensity={0.4} />
        <Directional color="#88ccff" intensity={1.6} position={[2, 9, 5]} />
      </Lighting>

      <EnvironmentContent />
    </Scene>
  );
}
