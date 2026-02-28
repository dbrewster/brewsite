import { JSX, ReactNode, useState } from 'react';
import { CodeBlock } from '../ui/CodeBlock';

interface LiveDemoProps {
  title?: string;
  children: ReactNode;
  code: string;
  defaultCodeOpen?: boolean;
}

export function LiveDemo({ title, children, code, defaultCodeOpen = false }: LiveDemoProps): JSX.Element {
  const [codeOpen, setCodeOpen] = useState(defaultCodeOpen);

  return (
    <section className="live-demo">
      <header className="live-demo__header">
        {title ? <span className="live-demo__title">{title}</span> : <span className="live-demo__title">Demo</span>}
        <button className="live-demo__code-toggle" type="button" onClick={() => setCodeOpen((value) => !value)}>
          {codeOpen ? 'Hide Code' : 'View Code'}
        </button>
      </header>
      <div className="live-demo__scene">{children}</div>
      {codeOpen ? (
        <div className="live-demo__code">
          <CodeBlock code={code} language="tsx" />
        </div>
      ) : null}
    </section>
  );
}
