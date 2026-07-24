import React from 'react';
import { Avatar } from '../core/Avatar.jsx';
import { Icon } from '../core/Icon.jsx';
// عنصر قائمة: صورة رمزية + اسم + حالة + ذيل
export function ListItem({ title, subtitle, avatarName, avatarTone, leading, status, trailing, chevron, onClick, disabled, style }) {
  return (
    <div onClick={disabled ? undefined : onClick} role={onClick ? 'button' : undefined} className={onClick && !disabled ? 'ds-hover' : ''}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 64, background: 'var(--surface)', cursor: onClick && !disabled ? 'pointer' : 'default', opacity: disabled ? 0.5 : 1, ...style }}>
      {leading ?? (avatarName && <Avatar name={avatarName} tone={avatarTone} />)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
      </div>
      {status}
      {trailing}
      {chevron && <Icon name="chevron-left" size={18} color="var(--text-3)" />}
    </div>
  );
}
