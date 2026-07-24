import React from 'react';
// نقطة حالة ملوّنة
const TONES = { success: 'var(--success-fg)', warning: 'var(--warning-fg)', danger: 'var(--danger-fg)', neutral: 'var(--text-3)' };
export function StatusDot({ tone = 'neutral', size = 8, style }) {
  return <span style={{ display: 'inline-block', flex: 'none', width: size, height: size, borderRadius: '50%', background: TONES[tone] || TONES.neutral, ...style }} />;
}
