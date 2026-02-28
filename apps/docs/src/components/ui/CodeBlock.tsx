import { JSX } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  code: string;
  language: 'tsx' | 'typescript' | 'bash' | 'json';
}

export function CodeBlock({ code, language }: CodeBlockProps): JSX.Element {
  return (
    <div className="code-block">
      <div className="code-block__toolbar">
        <span className="code-block__lang">{language}</span>
        <CopyButton text={code} />
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className} style={{ ...style, margin: 0, padding: '20px' }}>
            {tokens.map((line, index) => (
              <div key={index} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
