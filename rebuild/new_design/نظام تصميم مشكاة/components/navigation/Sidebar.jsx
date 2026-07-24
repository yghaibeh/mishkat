import React from 'react';
import { Icon } from '../core/Icon.jsx';
// شريط جانبي مكتبي (يمين الشاشة في RTL)
export function Sidebar({ items = [], activeId, onSelect, header, footer, width = 256 }) {
  return (
    <aside style={{ width, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderInlineEnd: '1px solid var(--border)', minHeight: '100%' }}>
      {header && <div style={{ padding: '20px 20px 12px' }}>{header}</div>}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', flex: 1 }}>
        {items.map((it) => it.section
          ? <div key={it.section} style={{ padding: '16px 12px 6px', fontSize: 11, fontWeight: 600, letterSpacing: '.02em', color: 'var(--text-3)' }}>{it.section}</div>
          : (() => { const active = it.id === activeId; return (
            <button key={it.id} type="button" onClick={() => onSelect && onSelect(it.id)} className={active ? '' : 'ds-hover'}
              style={{ display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 12px', border: 0, borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'start',
                background: active ? 'var(--primary-soft)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-2)', font: `${active ? 600 : 400} var(--fs-body)/1 var(--font)` }}>
              <Icon name={it.icon} size={19} />
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.count && <span style={{ fontSize: 12, fontWeight: 600, background: active ? 'var(--surface)' : 'var(--surface-2)', borderRadius: 'var(--r-full)', padding: '2px 8px' }}>{it.count}</span>}
            </button>
          ); })()
        )}
      </nav>
      {footer && <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </aside>
  );
}
