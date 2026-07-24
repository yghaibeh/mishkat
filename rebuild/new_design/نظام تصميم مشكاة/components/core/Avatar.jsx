import React from 'react';
// صورة رمزية بأحرف عربية
const SIZES = { sm: 32, md: 40, lg: 56 };
const TONES = {
  green: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  gold: { bg: 'var(--gold-bg)', fg: 'var(--gold)' },
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text-2)' },
};
export function Avatar({ name = '', size = 'md', tone = 'green', src, style }) {
  const px = SIZES[size] || SIZES.md;
  const t = TONES[tone] || TONES.green;
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + '\u200D' + parts[parts.length - 1][0] : (parts[0] || '؟')[0];
  const base = { width: px, height: px, borderRadius: 'var(--r-full)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style };
  if (src) return <img src={src} alt={name} style={{ ...base, objectFit: 'cover' }} />;
  return (
    <span title={name} style={{ ...base, background: t.bg, color: t.fg, fontWeight: 600, fontSize: px * 0.36, lineHeight: 1 }}>
      {initials}
    </span>
  );
}
