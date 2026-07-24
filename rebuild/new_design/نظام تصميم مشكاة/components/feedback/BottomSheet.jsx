import React from 'react';
import { Button } from '../actions/Button.jsx';
// Bottom Sheet للجوال / Modal تأكيد للمكتب
export function BottomSheet({ open, title, children, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', onConfirm, onCancel, danger, center }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'var(--overlay)', display: 'flex', flexDirection: 'column', justifyContent: center ? 'center' : 'flex-end', alignItems: center ? 'center' : 'stretch', padding: center ? 24 : 0 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: 'var(--surface)', borderRadius: center ? 'var(--r-lg)' : 'var(--r-xl) var(--r-xl) 0 0', boxShadow: 'var(--shadow-3)', padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', maxWidth: center ? 400 : undefined, width: center ? '100%' : undefined }}>
        {!center && <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '4px auto 14px' }} />}
        {title && <div style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)', fontWeight: 700, marginBottom: 8, paddingTop: center ? 10 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--text-2)', marginBottom: 16 }}>{children}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button full onClick={onConfirm} style={danger ? { background: 'var(--danger-fg)', color: '#fff' } : null}>{confirmLabel}</Button>
          <Button full variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}
