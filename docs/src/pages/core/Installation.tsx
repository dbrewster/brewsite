import { JSX } from 'react';
import { CodeBlock } from '../../components/ui/CodeBlock';
import { PropTable } from '../../components/ui/PropTable';
import { Callout } from '../../components/ui/Callout';

export default function Installation(): JSX.Element {
  return (
    <section>
      <h1>Installation</h1>

      <h2>Install the Package</h2>

      <p>Install <code>@brewsite/core</code> along with its peer dependencies via npm:</p>

      <CodeBlock
        language="bash"
        code="npm install @brewsite/core three react react-dom"
      />

      <p>Or with pnpm:</p>

      <CodeBlock
        language="bash"
        code="pnpm add @brewsite/core three react react-dom"
      />

      <h2>Peer Dependencies</h2>

      <p>
        The following packages must be installed in your project. They are declared as peer
        dependencies to avoid bundling duplicates when you consume <code>@brewsite/core</code> in a
        larger application.
      </p>

      <PropTable
        rows={[
          {
            name: 'three',
            type: '^0.183.1',
            required: true,
            description: 'Three.js rendering engine',
          },
          {
            name: 'react',
            type: '^19.2.4',
            required: true,
            description: 'React UI library',
          },
          {
            name: 'react-dom',
            type: '^19.2.4',
            required: true,
            description: 'React DOM bindings',
          },
        ]}
      />

      <h2>TypeScript</h2>

      <p>
        <code>@brewsite/core</code> is authored in strict TypeScript. All public APIs are fully
        typed, and the DSL's JSX components rely on TypeScript inference to provide helpful errors
        at authoring time. Strict mode is required.
      </p>

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

      <h2>Vite Setup</h2>

      <p>
        If you're consuming from a monorepo workspace or source, add these Vite aliases so imports
        resolve to the source TypeScript directly:
      </p>

      <CodeBlock
        language="typescript"
        code={`// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@brewsite/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
});`}
      />

      <Callout type="note">
        If you're not using Vite, import from the <code>dist/</code> output directly. The package
        ships CommonJS and ESM builds.
      </Callout>

      <h2>Optional: camera-controls</h2>

      <p>
        <code>camera-controls</code> is required only if you use{' '}
        <code>{'interaction: { enabled: true }'}</code> on the <code>&lt;Camera&gt;</code> element.
        It enables mouse/touch orbit, dolly, and pan interactions on the 3D canvas.
      </p>

      <CodeBlock
        language="bash"
        code="npm install camera-controls"
      />
    </section>
  );
}
