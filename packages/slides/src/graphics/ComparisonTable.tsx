// Comparison table component with feature rows and highlighted column.

import React, { type CSSProperties, type ReactElement } from 'react';
import type { ComparisonCellValue } from '../types';

/** Props for the ComparisonTable component. */
export type ComparisonTableProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a feature comparison table with optional column highlighting. */
export function ComparisonTable({
  headers,
  rows,
  highlightColumn,
  progress,
  className,
  style,
}: ComparisonTableProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  return (
    <div
      className={className}
      style={{
        opacity,
        overflow: 'auto',
        ...style,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          color: 'var(--brewsite-text-primary)',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderBottom: `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`,
                color: 'var(--brewsite-text-secondary)',
                fontWeight: 600,
              }}
            />
            {headers.map((header, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'center',
                  padding: '8px 12px',
                  borderBottom: `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`,
                  fontWeight: 600,
                  color: i === highlightColumn
                    ? 'var(--brewsite-accent-color)'
                    : 'var(--brewsite-text-primary)',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td
                style={{
                  padding: '8px 12px',
                  borderBottom: `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`,
                  color: 'var(--brewsite-text-primary)',
                  fontWeight: 500,
                }}
              >
                {row.feature}
              </td>
              {row.values.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    borderBottom: `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`,
                    background: ci === highlightColumn
                      ? 'var(--brewsite-surface-elevated)'
                      : 'transparent',
                    color: 'var(--brewsite-text-secondary)',
                  }}
                >
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: ComparisonCellValue): string {
  switch (cell.kind) {
    case 'check': return cell.value ? '✓' : '✗';
    case 'text': return cell.value;
    case 'number': return String(cell.value);
  }
}
