import React from 'react';
// Tabs بخط سفلي
export function Tabs({ tabs = [], activeId, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', ...style }}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={active} disabled={t.disabled} onClick={() => onChange && onChange(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', border: 0, background: 'transparent',
              cursor: t.disabled ? 'default' : 'pointer', color: t.disabled ? 'var(--text-disabled)' : active ? 'var(--primary)' : 'var(--text-2)',
              font: `${active ? 600 : 400} var(--fs-body)/1.2 var(--font)`, boxShadow: active ? 'inset 0 -2px 0 var(--primary)' : 'none', marginBottom: -1 }}>
            {t.label}
            {t.count != null && <span style={{ fontSize: 12, fontWeight: 600, background: active ? 'var(--primary-soft)' : 'var(--surface-2)', borderRadius: 'var(--r-full)', padding: '1px 8px' }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
