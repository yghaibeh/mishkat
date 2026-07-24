import React from 'react';
import { Icon } from '../core/Icon.jsx';
// شريط بحث + صف فلاتر حبّية
export function SearchBar({ value, onChange, placeholder = 'ابحث…', filters = [], activeFilters = [], onToggleFilter, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <div style={{ position: 'relative' }}>
        <Icon name="search" size={18} color="var(--text-3)" style={{ position: 'absolute', insetInlineStart: 14, top: 15 }} />
        <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)}
          style={{ width: '100%', height: 48, padding: '0 44px 0 14px', borderRadius: 'var(--r-full)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-1)', font: `400 var(--fs-body)/1.2 var(--font)`, outline: 'none' }} />
      </div>
      {filters.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {filters.map((f) => {
            const on = activeFilters.includes(f);
            return (
              <button key={f} type="button" onClick={() => onToggleFilter && onToggleFilter(f)}
                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 'var(--r-full)', cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-soft)' : 'var(--surface)',
                  color: on ? 'var(--primary)' : 'var(--text-2)', font: `${on ? 600 : 400} var(--fs-caption)/1 var(--font)`, transition: 'background var(--dur-1) var(--ease)' }}>
                {on && <Icon name="check" size={14} />}
                {f}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
