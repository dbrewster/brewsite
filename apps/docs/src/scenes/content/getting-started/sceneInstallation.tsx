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

function InstallationContent(): JSX.Element {
  return (
    <DocPanel slideInBy={0.3}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: '0 0 8px', fontWeight: 700 }}>
        Installation
      </h1>

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 12px' }}>Install the Package</h2>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Install <code>@brewsite/core</code> along with its peer dependencies:
      </p>
      <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '8px 0 12px' }}>Or with pnpm:</p>
      <CodeBlock language="bash" code="pnpm add @brewsite/core three react react-dom" />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 12px' }}>Peer Dependencies</h2>
      <PropTable
        rows={[
          { name: 'three',     type: '^0.183.1', required: true, description: 'Three.js rendering engine' },
          { name: 'react',     type: '^19.2.4',  required: true, description: 'React UI library' },
          { name: 'react-dom', type: '^19.2.4',  required: true, description: 'React DOM bindings' },
        ]}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 12px' }}>TypeScript</h2>
      <Callout type="note">
        Strict TypeScript is required. Set <code>strict: true</code> in your tsconfig.
      </Callout>
      <CodeBlock
        language="json"
        code={`{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler"
  }
}`}
      />

      <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: '20px 0 12px' }}>Optional: camera-controls</h2>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Required only if you use <code>{`interaction: { enabled: true }`}</code> on the{' '}
        <code>&lt;Camera&gt;</code> element for mouse/touch orbit interactions.
      </p>
      <CodeBlock language="bash" code="npm install camera-controls" />
    </DocPanel>
  );
}

export function SceneInstallation(): JSX.Element {
  return (
    <Scene key="scene-installation" id="scene-installation">
      <ProgressManager scrollUnits={1600} fn={DWELL_FN} />
      <Camera mode="world" position={[1, 2, 8]} target={[0, 0.8, 0]} fov={40} />
      <Background color="#0d0f1a" />
      <Lighting>
        <Ambient color="#4466ff" intensity={0.4} />
        <Directional color="#ffffff" intensity={1.6} position={[2, 10, 7]} />
      </Lighting>

      <InstallationContent />
    </Scene>
  );
}
