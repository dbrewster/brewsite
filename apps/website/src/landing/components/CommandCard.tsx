// CTA command block with copy-to-clipboard behavior.

import { useState, useCallback } from 'react';
import type { JSX } from 'react';

/** Props for the CommandCard component. */
export type CommandCardProps = {
  readonly command: string;
  readonly secondaryLabel?: string;
  readonly secondaryHref?: string;
  readonly onCopy?: (command: string) => void;
};

/**
 * Render the CTA command block.
 * Owns copy-to-clipboard behavior and signals copy via onCopy callback.
 */
export function CommandCard({
  command,
  secondaryLabel,
  secondaryHref,
  onCopy,
}: CommandCardProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      onCopy?.(command);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API unavailable — silent no-op.
    });
  }, [command, onCopy]);

  return (
    <div className="command-card">
      <button
        className="command-card__copy"
        onClick={handleCopy}
        aria-label={`Copy command: ${command}`}
      >
        <span className="command-card__prompt" aria-hidden="true">
          $
        </span>
        <span className="command-card__text">{command}</span>
        <span className="command-card__action">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>

      {secondaryLabel && secondaryHref && (
        <a
          className="command-card__secondary"
          href={secondaryHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {secondaryLabel}
        </a>
      )}
    </div>
  );
}
