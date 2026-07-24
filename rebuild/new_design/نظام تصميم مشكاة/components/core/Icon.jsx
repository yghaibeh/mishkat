import React from 'react';
// أيقونات Lucide عبر CSS mask لتلوينها بـ currentColor
export function Icon({ name, size = 20, color = 'currentColor', style }) {
  const m = `url(https://unpkg.com/lucide-static@0.462.0/icons/${name}.svg) center / contain no-repeat`;
  return <span aria-hidden="true" style={{ display: 'inline-block', flex: 'none', width: size, height: size, backgroundColor: color, WebkitMask: m, mask: m, ...style }} />;
}
