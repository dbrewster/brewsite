// Copy-to-clipboard button with transient "Copied" feedback state.

import { useState, type ReactElement } from 'react';

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      className="copy-btn"
      type="button"
      onClick={handleCopy}
      style={{
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'transparent',
        color: 'var(--text-secondary, #8888aa)',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}
