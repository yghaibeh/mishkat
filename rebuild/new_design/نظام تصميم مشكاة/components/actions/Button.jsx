import React from 'react';
import { Icon } from '../core/Icon.jsx';
// زر أساسي / ثانوي / شبحي
const H = { sm: 40, md: 48, lg: 56 };
export function Button({ variant = 'primary', size = 'md', disabled, loading, icon, full, children, onClick, style }) {
  const base = {
    display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    height: H[size] || H.md, padding: '0 20px', borderRadius: 'var(--r-md)',
    font: `600 var(--fs-body)/1 var(--font)`, cursor: disabled || loading ? 'default' : 'pointer',
    border: '1px solid transparent', whiteSpace: 'nowrap',
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--on-primary)' },
    secondary: { background: 'var(--surface)', color: 'var(--text-1)', borderColor: 'var(--border-strong)' },
    ghost: { background: 'transparent', color: 'var(--primary)' },
  };
  const disabledStyle = { background: 'var(--surface-2)', color: 'var(--text-disabled)', borderColor: 'transparent' };
  const spinnerColor = variant === 'primary' ? 'var(--on-primary)' : 'var(--primary)';
  return (
    <button type="button" className={`ds-btn${variant === 'ghost' ? ' ds-ghost' : ''}`} disabled={disabled || loading} onClick={onClick}
      style={{ ...base, ...(variants[variant] || variants.primary), ...(disabled ? disabledStyle : null), ...style }}>
      {loading
        ? <span className="ds-spin" style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${spinnerColor}`, borderTopColor: 'transparent' }} />
        : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}
