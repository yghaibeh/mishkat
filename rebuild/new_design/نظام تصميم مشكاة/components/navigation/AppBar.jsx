import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Chip } from '../core/Chip.jsx';
// AppBar علوي للجوال
export function AppBar({ title, subtitle, roleBadge, bellCount, onBell, leadingIcon, onLeading, elevated, trailing }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', boxShadow: elevated ? 'var(--shadow-1)' : 'none', borderBottom: elevated ? 'none' : '1px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 56 }}>
        {leadingIcon && (
          <button type="button" onClick={onLeading} className="ds-hover" style={{ width: 44, height: 44, margin: '-8px -8px -8px 0', border: 0, background: 'transparent', borderRadius: 'var(--r-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-1)' }}>
            <Icon name={leadingIcon} size={22} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-title)', lineHeight: 'var(--lh-title)', fontWeight: 700 }}>{title}</span>
            {roleBadge && <Chip status="neutral" label={roleBadge} size="sm" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'transparent' }} />}
          </div>
          {subtitle && <div style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
        </div>
        {trailing}
        {bellCount != null && (
          <button type="button" onClick={onBell} className="ds-hover" aria-label="الإشعارات" style={{ position: 'relative', width: 44, height: 44, border: 0, background: 'transparent', borderRadius: 'var(--r-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-1)' }}>
            <Icon name="bell" size={22} />
            {bellCount > 0 && <span style={{ position: 'absolute', top: 4, insetInlineStart: 24, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 'var(--r-full)', background: 'var(--danger-fg)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{bellCount}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
