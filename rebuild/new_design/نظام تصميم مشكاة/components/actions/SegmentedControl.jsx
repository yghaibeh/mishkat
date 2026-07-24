import React from 'react';
// تحكم مقسّم — خيارات قليلة متنافية
export function SegmentedControl({ options = [], value, onChange, size = 'md', disabled, style }) {
  const h = size === 'sm' ? 32 : 40;
  return (
    <div role="tablist" style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 'var(--r-full)', padding: 3, gap: 2, opacity: disabled ? 0.5 : 1, ...style }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button key={opt} type="button" role="tab" aria-selected={active} disabled={disabled} onClick={() => onChange && onChange(opt)}
            style={{ height: h - 6, padding: '0 16px', borderRadius: 'var(--r-full)', border: 0, cursor: disabled ? 'default' : 'pointer',
              background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text-1)' : 'var(--text-2)',
              font: `${active ? 600 : 400} var(--fs-caption)/1 var(--font)`, boxShadow: active ? 'var(--shadow-1)' : 'none',
              transition: 'background var(--dur-1) var(--ease)' }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}
