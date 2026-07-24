import React from 'react';
import { Icon } from '../core/Icon.jsx';
// مفتاح حضور/غياب سريع — تسجيل قائمة كاملة بإبهام واحد، هدف لمس ≥44px
export function AttendanceSwitch({ value = null, onChange, disabled, compact }) {
  const seg = (key, label, icon, colors) => {
    const active = value === key;
    return (
      <button key={key} type="button" disabled={disabled} aria-pressed={active}
        onClick={() => onChange && onChange(active ? null : key)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          minWidth: compact ? 44 : 64, height: 44, padding: '0 10px', border: 0, borderRadius: 'var(--r-full)',
          cursor: disabled ? 'default' : 'pointer', font: `600 var(--fs-caption)/1 var(--font)`,
          background: active ? colors.bg : 'transparent', color: active ? colors.fg : 'var(--text-3)',
          boxShadow: active ? 'var(--shadow-1)' : 'none', transition: 'background var(--dur-1) var(--ease), color var(--dur-1) var(--ease)' }}>
        <Icon name={icon} size={18} />
        {!compact && label}
      </button>
    );
  };
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 'var(--r-full)', padding: 3, gap: 2, opacity: disabled ? 0.5 : 1 }}>
      {seg('present', 'حاضر', 'check', { bg: 'var(--primary)', fg: 'var(--on-primary)' })}
      {seg('absent', 'غائب', 'x', { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' })}
    </div>
  );
}
