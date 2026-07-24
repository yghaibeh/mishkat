import React from 'react';
import { StatusDot } from './StatusDot.jsx';
// Chip/Badge للحالات: معتمد / معلّق / متأخر
const STATUS = {
  approved: { label: 'معتمد', bg: 'var(--success-bg)', fg: 'var(--success-fg)', bd: 'var(--success-border)', dot: 'success' },
  pending: { label: 'معلّق', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)', bd: 'var(--warning-border)', dot: 'warning' },
  late: { label: 'متأخر', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', bd: 'var(--danger-border)', dot: 'danger' },
  neutral: { label: '', bg: 'var(--surface-2)', fg: 'var(--text-2)', bd: 'var(--border)', dot: 'neutral' },
};
export function Chip({ status = 'neutral', label, withDot = false, size = 'md', style }) {
  const s = STATUS[status] || STATUS.neutral;
  const sm = size === 'sm';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, borderRadius: 'var(--r-full)', padding: sm ? '1px 10px' : '3px 12px', fontSize: sm ? 12 : 'var(--fs-caption)', lineHeight: '18px', fontWeight: 600, whiteSpace: 'nowrap', ...style }}>
      {withDot && <StatusDot tone={s.dot} size={6} />}
      {label ?? s.label}
    </span>
  );
}
