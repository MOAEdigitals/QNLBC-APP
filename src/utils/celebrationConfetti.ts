import type { CSSProperties } from 'react';

/** A stable random scatter for each card, confined by CSS to its empty outer frame. */
export function celebrationConfetti(seed: string): CSSProperties {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const random = () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    return (state >>> 0) / 4294967296;
  };
  const colors = ['#7dd3fc', '#fbbf24', '#c4b5fd', '#fb7185'];
  const pieces = Array.from({ length: 14 }, (_, index) => {
    const color = colors[Math.floor(random() * colors.length)];
    const across = `${(8 + random() * 84).toFixed(2)}%`;
    const edge = index % 4;
    const x = edge < 2 ? across : edge === 2 ? '3px' : 'calc(100% - 3px)';
    const y = edge === 0 ? '3px' : edge === 1 ? 'calc(100% - 3px)' : `${(20 + random() * 60).toFixed(2)}%`;
    const width = (2 + random() * 2).toFixed(1);
    return index % 3 === 0
      ? `radial-gradient(circle, ${color} 55%, transparent 65%) ${x} ${y} / ${width}px ${width}px no-repeat`
      : `linear-gradient(${Math.floor(random() * 150)}deg, transparent 15%, ${color} 20% 80%, transparent 85%) ${x} ${y} / ${width}px 5px no-repeat`;
  });
  return { '--celebration-confetti': pieces.join(',') } as CSSProperties;
}
