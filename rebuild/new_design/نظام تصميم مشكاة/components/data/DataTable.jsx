import React from 'react';
import { Icon } from '../core/Icon.jsx';
// جدول بيانات مكتبي قابل للفرز
export function DataTable({ columns = [], rows = [], sortKey, sortDir = 'desc', onSort, renderCell, rowKey, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-1)', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-body)' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            {columns.map((c) => (
              <th key={c.key} onClick={c.sortable ? () => onSort && onSort(c.key) : undefined}
                style={{ textAlign: c.align || 'start', padding: '10px 16px', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-2)', cursor: c.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.label}
                  {c.sortable && <Icon name={sortKey === c.key ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'} size={13} color={sortKey === c.key ? 'var(--primary)' : 'var(--text-3)'} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} className="ds-hover" style={{ borderTop: '1px solid var(--border)' }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '12px 16px', textAlign: c.align || 'start', verticalAlign: 'middle' }}>
                  {renderCell ? renderCell(r, c.key) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
