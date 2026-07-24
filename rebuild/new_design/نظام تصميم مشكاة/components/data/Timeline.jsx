import React from 'react';
import { Icon } from '../core/Icon.jsx';
// Timeline أفقي بسيط لمراحل: خطة ⟵ اعتماد ⟵ صرف
export function Timeline({ steps = [], style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', ...style }}>
      {steps.map((s, i) => {
        const done = s.state === 'done', current = s.state === 'current';
        return (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ flex: 1, height: 2, marginTop: 13, borderRadius: 1, background: done || current ? 'var(--primary)' : 'var(--border-strong)' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                background: done ? 'var(--primary)' : current ? 'var(--primary-soft)' : 'var(--surface-2)',
                border: current ? '2px solid var(--primary)' : '2px solid transparent',
                color: done ? 'var(--on-primary)' : current ? 'var(--primary)' : 'var(--text-3)' }}>
                {done ? <Icon name="check" size={14} /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />}
              </span>
              <span style={{ fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)', fontWeight: current || done ? 600 : 400, color: current ? 'var(--primary)' : done ? 'var(--text-1)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>{s.label}</span>
              {s.caption && <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -4 }}>{s.caption}</span>}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
