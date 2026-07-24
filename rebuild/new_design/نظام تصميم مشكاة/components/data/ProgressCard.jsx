import React from 'react';
import { arabicNum } from '../core/format.js';
// بطاقة تقدّم بحلقة أو شريط — «٤١ من ٧٠ نقطة»
export function ProgressCard({ title, value = 0, max = 100, unit = 'نقطة', remaining, footnote, variant = 'ring', style }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const R = 44, C = 2 * Math.PI * R;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', boxShadow: 'var(--shadow-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-5)', ...style }}>
      {variant === 'ring' && (
        <div style={{ position: 'relative', width: 104, height: 104, flex: 'none' }}>
          <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'scaleX(-1) rotate(-90deg)' }}>
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset var(--dur-2) var(--ease)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{arabicNum(value)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>من {arabicNum(max)}</span>
          </div>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)', fontWeight: 600 }}>{title}</div>
        {variant === 'bar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--fs-display)', lineHeight: 1.1, fontWeight: 700 }}>{arabicNum(value)} <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', fontWeight: 500 }}>من {arabicNum(max)} {unit}</span></div>
            <div style={{ height: 8, borderRadius: 'var(--r-full)', background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 'var(--r-full)', background: 'var(--primary)', transition: 'width var(--dur-2) var(--ease)' }} />
            </div>
          </div>
        )}
        {remaining && <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{remaining}</div>}
        {footnote && <div style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', color: 'var(--text-3)' }}>{footnote}</div>}
      </div>
    </div>
  );
}
