// API reference table for component/function props.

import { type ReactElement } from 'react';

export interface PropRow {
  /** Prop name. */
  name: string;
  /** TypeScript type string. */
  type: string;
  /** Whether the prop is required. Displays a * marker when true. */
  required?: boolean;
  /** Default value as a string. Omit when there is no default. */
  defaultValue?: string;
  /** Description of the prop's behavior. */
  description: string;
}

export interface PropTableProps {
  rows: PropRow[];
}

/**
 * Tabular API reference for component props.
 * CSS class: `.prop-table`
 */
export function PropTable({ rows }: PropTableProps): ReactElement {
  return (
    <table className="prop-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Prop</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Type</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Default</th>
          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))' }}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              <code>{row.name}</code>
              {row.required === true && (
                <span className="prop-table__required" style={{ color: 'var(--accent-orange, #f97316)', marginLeft: 4 }}>*</span>
              )}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              <code style={{ color: 'var(--text-code, #c0c0e0)' }}>{row.type}</code>
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              {row.defaultValue !== undefined ? <code>{row.defaultValue}</code> : <span style={{ color: 'var(--text-muted, #55556a)' }}>—</span>}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              {row.description}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
