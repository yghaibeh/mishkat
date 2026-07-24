import React from 'react';
import { Icon } from '../core/Icon.jsx';
// شريط تنقّل سفلي (٥–٦ وجهات)
export function BottomNav({ items = [], activeId, onSelect }) {
  return (
    <nav style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button key={it.id} type="button" onClick={() => onSelect && onSelect(it.id)}
            style={{ flex: 1, minWidth: 0, height: 60, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: active ? 'var(--primary)' : 'var(--text-3)', position: 'relative' }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 26, borderRadius: 'var(--r-full)', background: active ? 'var(--primary-soft)' : 'transparent', transition: 'background var(--dur-2) var(--ease)' }}>
              <Icon name={it.icon} size={21} />
            </span>
            <span style={{ fontSize: 11, lineHeight: '14px', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{it.label}</span>
            {it.badge && <span style={{ position: 'absolute', top: 6, insetInlineStart: '50%', marginInlineStart: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger-fg)' }} />}
          </button>
        );
      })}
    </nav>
  );
}
