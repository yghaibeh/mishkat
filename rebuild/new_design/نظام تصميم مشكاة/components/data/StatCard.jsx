import React from 'react';
import { Icon } from '../core/Icon.jsx';
// بطاقة رقم كبير + عنوان + سياق
const TONES = { default: 'var(--text-1)', success: 'var(--success-fg)', warning: 'var(--warning-fg)', danger: 'var(--danger-fg)' };
export function StatCard({ value, suffix, label, context, tone = 'default', trend, onClick, style }) {
  return (
    <div onClick={onClick} className={onClick ? 'ds-hover' : ''} role={onClick ? 'button' : undefined}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', boxShadow: 'var(--shadow-1)', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
      <div style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-2)', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-display)', fontWeight: 700, color: TONES[tone] || TONES.default, letterSpacing: '-.01em' }}>{value}</span>
        {suffix && <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', fontWeight: 500 }}>{suffix}</span>}
      </div>
      {(context || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-3)' }}>
          {trend && <Icon name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus'} size={14} color={trend === 'up' ? 'var(--success-fg)' : trend === 'down' ? 'var(--danger-fg)' : 'var(--text-3)'} />}
          {context}
        </div>
      )}
    </div>
  );
}
