import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { arabicNum } from '../core/format.js';
// عدّاد رقمي بأزرار ± بأهداف لمس ٤٤px — للساعات والدقائق والمقادير
export function StepperField({ label, value = 0, onChange, min = 0, max = 99, step = 1, unit, disabled, style }) {
  const set = (n) => onChange && onChange(Math.max(min, Math.min(max, n)));
  const btn = (icon, delta, edge) => (
    <button type="button" disabled={disabled || (delta > 0 ? value >= max : value <= min)} onClick={() => set(value + delta)} className="ds-hover"
      style={{ width: 44, height: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', borderRadius: edge, opacity: disabled || (delta > 0 ? value >= max : value <= min) ? 0.35 : 1 }}>
      <Icon name={icon} size={18} />
    </button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', fontWeight: 600, color: disabled ? 'var(--text-disabled)' : 'var(--text-2)' }}>{label}</span>}
      <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', background: disabled ? 'var(--surface-2)' : 'var(--surface)', opacity: disabled ? 0.6 : 1 }}>
        {btn('plus', step, 'var(--r-md) 0 0 var(--r-md)')}
        <span style={{ minWidth: 56, textAlign: 'center', fontSize: 'var(--fs-section)', fontWeight: 600, borderInline: '1px solid var(--border)', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {arabicNum(value)}{unit && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>{unit}</span>}
        </span>
        {btn('minus', -step, '0 var(--r-md) var(--r-md) 0')}
      </div>
    </div>
  );
}
