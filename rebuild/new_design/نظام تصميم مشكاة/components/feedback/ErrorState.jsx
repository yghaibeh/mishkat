import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../actions/Button.jsx';
// حالة خطأ إنسانية — بلا لوم ولا تفاصيل تقنية
export function ErrorState({ title = 'تعذّر تحميل البيانات', message = 'لا يبدو أنها مشكلة من عندك — نحاول من جديد؟', retryLabel = 'إعادة المحاولة', onRetry, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 24px', textAlign: 'center', ...style }}>
      <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name="cloud-off" size={30} color="var(--danger-fg)" />
      </span>
      <div style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--text-2)', maxWidth: 300 }}>{message}</div>
      {retryLabel && <Button variant="secondary" size="sm" icon="rotate-ccw" onClick={onRetry} style={{ marginTop: 8 }}>{retryLabel}</Button>}
    </div>
  );
}
