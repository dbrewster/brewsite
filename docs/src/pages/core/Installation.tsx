import type { ReactElement } from 'react';
import { Section, CodeBlock, PropTable, Callout } from '@brewsite/docs';
import type { SectionId } from '../../docs-nav';

export function InstallationPage(): ReactElement {
  return (
    <Section<SectionId> id="installation" title="Installation">
      <h2>Install the Package</h2>
      <p>Install <code>@brewsite/core</code> along with its peer dependencies via npm:</p>
      <CodeBlock language="bash" code="npm install @brewsite/core three react react-dom" />
      <p>Or with pnpm:</p>
      <CodeBlock language="bash" code="pnpm add @brewsite/core three react react-dom" />

      <h2>Peer Dependencies</h2>
      <PropTable
        rows={[
          { name: 'three', type: '^0.183.1', required: true, description: 'Three.js rendering engine' },
          { name: 'react', type: '^19.2.4', required: true, description: 'React UI library' },
          { name: 'react-dom', type: '^19.2.4', required: true, description: 'React DOM bindings' },
        ]}
      />

      <h2>TypeScript</h2>
      <p>
        <code>@brewsite/core</code> is authored in strict TypeScript. Strict mode is required.
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

      <h2>Optional: camera-controls</h2>
      <p>
        <code>camera-controls</code> is required only if you use{' '}
        <code>{'interaction: { enabled: true }'}</code> on the <code>&lt;Camera&gt;</code> element.
      </p>
      <CodeBlock language="bash" code="npm install camera-controls" />
    </Section>
  );
}
