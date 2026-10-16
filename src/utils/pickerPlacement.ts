/** Keep suggestions inside the usable form area, excluding its sticky actions. */
export function pickerPlacement(input: { top: number; bottom: number }, top: number, bottom: number, desiredHeight: number) {
  const gap = 6;
  const below = Math.max(0, bottom - Math.max(top, input.bottom + gap));
  const above = Math.max(0, Math.min(bottom, input.top - gap) - top);
  const placeAbove = below < Math.min(240, desiredHeight) && above > below;
  const maxHeight = Math.min(desiredHeight, placeAbove ? above : below);
  return {
    top: placeAbove ? Math.max(top, Math.min(bottom, input.top - gap) - maxHeight) : Math.max(top, Math.min(bottom, input.bottom + gap)),
    maxHeight,
  };
}
