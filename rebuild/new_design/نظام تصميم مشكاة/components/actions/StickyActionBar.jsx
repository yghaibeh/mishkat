import React from 'react';
import { Button } from './Button.jsx';
// زر فعل لاصق أسفل الشاشة — بمتناول الإبهام
export function StickyActionBar({ label, hint, icon, disabled, loading, onClick, children }) {
  return (
    <div style={{ position: 'sticky', bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, padding: '20px 16px calc(12px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 62%, transparent)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hint && <div style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-2)', textAlign: 'center' }}>{hint}</div>}
      {children ?? (
        <Button size="lg" full icon={icon} disabled={disabled} loading={loading} onClick={onClick}
          style={{ boxShadow: disabled ? 'none' : 'var(--shadow-3)' }}>
          {label}
        </Button>
      )}
    </div>
  );
}
