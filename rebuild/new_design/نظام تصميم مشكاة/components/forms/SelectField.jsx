import React from 'react';
import { Icon } from '../core/Icon.jsx';
// حقل اختيار (select أهلي بمظهر النظام)
export function SelectField({ label, options = [], value, onChange, placeholder = 'اختر…', error, disabled, style }) {
  const border = error ? 'var(--danger-fg)' : 'var(--border-strong)';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', fontWeight: 600, color: disabled ? 'var(--text-disabled)' : 'var(--text-2)' }}>{label}</span>}
      <span style={{ position: 'relative', display: 'block' }}>
        <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange && onChange(e.target.value)}
          style={{ width: '100%', height: 48, padding: '0 14px', paddingInlineEnd: 40, borderRadius: 'var(--r-md)', border: `1px solid ${border}`,
            background: disabled ? 'var(--surface-2)' : 'var(--surface)', color: value ? (disabled ? 'var(--text-disabled)' : 'var(--text-1)') : 'var(--text-3)',
            font: `400 var(--fs-body)/1.2 var(--font)`, appearance: 'none', outline: 'none', cursor: disabled ? 'default' : 'pointer' }}>
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Icon name="chevron-down" size={18} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 12, top: 15, pointerEvents: 'none' }} />
      </span>
      {error && <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--danger-fg)' }}>{error}</span>}
    </label>
  );
}
