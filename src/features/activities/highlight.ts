/** Three gentle outline pulses, without changing card contents or scroll position. */
export function highlightActivityCards(cards: HTMLElement[], reducedMotion = false) {
  for (const card of cards) {
    card.getAnimations().filter(animation => animation.id === 'activity-date-highlight').forEach(animation => animation.cancel());
    const visible = { outlineColor: 'var(--ui-accent)', outlineWidth: '2px', outlineStyle: 'solid', outlineOffset: '2px' };
    const animation = card.animate(reducedMotion ? [visible, visible] : [
      { ...visible, outlineColor: 'transparent' }, visible, { ...visible, outlineColor: 'transparent' },
    ], { duration: reducedMotion ? 1500 : 500, iterations: reducedMotion ? 1 : 3 });
    animation.id = 'activity-date-highlight';
  }
}
