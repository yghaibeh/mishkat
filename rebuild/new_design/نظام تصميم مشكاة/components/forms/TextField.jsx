import React from 'react';
// حقل نص (وtextarea)
export function TextField({ label, value, onChange, placeholder, helper, error, disabled, multiline, type = 'text', style }) {
  const border = error ? 'var(--danger-fg)' : 'var(--border-strong)';
  const shared = {
    width: '100%', padding: multiline ? '12px 14px' : '0 14px', height: multiline ? undefined : 48, minHeight: multiline ? 88 : undefined,
    borderRadius: 'var(--r-md)', border: `1px solid ${border}`, background: disabled ? 'var(--surface-2)' : 'var(--surface)',
    color: disabled ? 'var(--text-disabled)' : 'var(--text-1)', font: `400 var(--fs-body)/var(--lh-body) var(--font)`, outline: 'none', resize: 'vertical',
  };
  const props = { value, placeholder, disabled, onChange: (e) => onChange && onChange(e.target.value), style: shared };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', fontWeight: 600, color: disabled ? 'var(--text-disabled)' : 'var(--text-2)' }}>{label}</span>}
      {multiline ? <textarea {...props} /> : <input type={type} {...props} />}
      {(error || helper) && <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: error ? 'var(--danger-fg)' : 'var(--text-3)' }}>{error || helper}</span>}
    </label>
  );
}
