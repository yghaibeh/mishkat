import React from 'react';
// هيكل تحميل بوميض هادئ (صنف ds-skeleton من tokens/effects.css)
export function Skeleton({ variant = 'text', width = '100%', height, style }) {
  const h = height ?? (variant === 'text' ? 14 : variant === 'circle' ? 40 : 72);
  const w = variant === 'circle' ? h : width;
  return <span className="ds-skeleton" style={{ display: 'block', width: w, height: h, borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? 6 : 'var(--r-md)', ...style }} />;
}
