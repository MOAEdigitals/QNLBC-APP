import { COLOR_PALETTE } from './personColors';

// Repeat the existing leader palette six months apart, including December–January.
const sequence = [
  COLOR_PALETTE.sky, COLOR_PALETTE.amber, COLOR_PALETTE.indigo,
  COLOR_PALETTE.green, COLOR_PALETTE.blue, COLOR_PALETTE.fuchsia,
];

export const BIRTHDAY_MONTH_COLORS = Array.from({ length: 12 }, (_, month) => {
  const color = sequence[month % sequence.length];
  return {
    text: color.textBold,
    line: `${color.dot} opacity-35`,
    card: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badge: color.pill,
  };
});
