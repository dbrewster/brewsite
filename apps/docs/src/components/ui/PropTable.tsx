import { JSX } from 'react';

export interface PropRow {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description: string;
}

interface PropTableProps {
  rows: PropRow[];
}

export function PropTable({ rows }: PropTableProps): JSX.Element {
  return (
    <table className="prop-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              {row.name}
              {row.required ? <span className="prop-table__required">*</span> : null}
            </td>
            <td>
              <code>{row.type}</code>
            </td>
            <td>{row.defaultValue ? <code>{row.defaultValue}</code> : <span className="prop-table__empty">-</span>}</td>
            <td>{row.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
