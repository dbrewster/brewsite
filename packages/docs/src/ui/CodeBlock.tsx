// Syntax-highlighted code block with copy button. Uses prism-react-renderer.

import { type ReactElement } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CopyButton } from './CopyButton';

/** Supported syntax highlighting languages. Extend as needed. */
export type CodeLanguage = 'tsx' | 'typescript' | 'bash' | 'json' | 'css';

export interface CodeBlockProps {
  /** The code string to display. Leading/trailing whitespace is trimmed. */
  code: string;
  /** Syntax highlighting language. Defaults to 'typescript'. */
  language?: CodeLanguage;
}

/**
 * Syntax-highlighted code block.
 *
 * Renders a dark code block using prism-react-renderer nightOwl theme.
 * Includes a copy-to-clipboard button in the toolbar.
 *
 * CSS class surface (for consumer styling):
 * - `.code-block` — root wrapper
 * - `.code-block__toolbar` — toolbar row (language label + copy button)
 * - `.code-block__lang` — language label
 */
export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps): ReactElement {
  return (
    <div className="code-block" style={{ borderRadius: 8, overflow: 'hidden', margin: '16px 0' }}>
      <div
        className="code-block__toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'var(--bg-code, #12121a)',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
        }}
      >
        <span
          className="code-block__lang"
          style={{ fontSize: 11, color: 'var(--text-muted, #55556a)', fontFamily: 'var(--font-mono)' }}
        >
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className}
            style={{ ...style, margin: 0, padding: '20px', overflowX: 'auto', fontSize: 13 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, j) => (
                  <span key={j} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
