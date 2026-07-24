import React from 'react';
import { Icon } from '../core/Icon.jsx';
// Toast عائم أسفل الشاشة
const TONES = {
  success: { icon: 'check-circle-2', color: 'var(--primary-strong)' },
  danger: { icon: 'alert-circle', color: 'var(--danger-fg)' },
  neutral: { icon: 'info', color: 'var(--text-2)' },
};
export function Toast({ message, tone = 'success', actionLabel, onAction, style }) {
  const t = TONES[tone] || TONES.success;
  return (
    <div className="ds-toast" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: 420, padding: '12px 18px', borderRadius: 'var(--r-full)', background: 'var(--text-1)', color: 'var(--bg)', boxShadow: 'var(--shadow-3)', fontSize: 'var(--fs-body)', fontWeight: 500, ...style }}>
      <Icon name={t.icon} size={19} color={tone === 'success' ? 'var(--green-300)' : tone === 'danger' ? '#F0A79D' : 'var(--bg)'} />
      <span style={{ flex: 1 }}>{message}</span>
      {actionLabel && (
        <button type="button" onClick={onAction} style={{ border: 0, background: 'transparent', color: 'var(--green-300)', font: `600 var(--fs-caption)/1 var(--font)`, cursor: 'pointer', padding: '6px 4px', whiteSpace: 'nowrap' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
