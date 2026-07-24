import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../actions/Button.jsx';
// حالة فارغة: قرص أيقونة + رسالة + فعل
export function EmptyState({ icon = 'inbox', title, message, actionLabel, onAction, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 24px', textAlign: 'center', ...style }}>
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={30} color="var(--primary)" />
      </span>
      <div style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)', fontWeight: 600 }}>{title}</div>
      {message && <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--text-2)', maxWidth: 300 }}>{message}</div>}
      {actionLabel && <Button variant="secondary" size="sm" onClick={onAction} style={{ marginTop: 8 }}>{actionLabel}</Button>}
    </div>
  );
}
