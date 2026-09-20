export interface PersonColor {
  key: string;
  name: string;
  text: string;
  textBold: string;
  bgLight: string;
  border: string;
  borderStrong: string;
  badge: string;
  pill: string;
  dot: string;
}

export const COLOR_PALETTE: Record<string, PersonColor> = {
  blue: {
    key: 'blue',
    name: 'Blue',
    text: 'text-blue-600 dark:text-blue-400',
    textBold: 'text-blue-700 dark:text-blue-300',
    bgLight: 'bg-blue-50 dark:bg-blue-950/60',
    border: 'border-blue-200 dark:border-blue-800',
    borderStrong: 'border-blue-500/80 dark:border-blue-500/70',
    badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    pill: 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  violet: {
    key: 'violet',
    name: 'Violet',
    text: 'text-violet-600 dark:text-violet-400',
    textBold: 'text-violet-700 dark:text-violet-300',
    bgLight: 'bg-violet-50 dark:bg-violet-950/60',
    border: 'border-violet-200 dark:border-violet-800',
    borderStrong: 'border-violet-500/80 dark:border-violet-500/70',
    badge: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800',
    pill: 'bg-violet-100 dark:bg-violet-950/70 text-violet-800 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  green: {
    key: 'green',
    name: 'Green',
    text: 'text-emerald-600 dark:text-emerald-400',
    textBold: 'text-emerald-700 dark:text-emerald-300',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/60',
    border: 'border-emerald-200 dark:border-emerald-800',
    borderStrong: 'border-emerald-500/80 dark:border-emerald-500/70',
    badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    pill: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  amber: {
    key: 'amber',
    name: 'Amber',
    text: 'text-amber-600 dark:text-amber-400',
    textBold: 'text-amber-700 dark:text-amber-300',
    bgLight: 'bg-amber-50 dark:bg-amber-950/60',
    border: 'border-amber-200 dark:border-amber-800',
    borderStrong: 'border-amber-500/80 dark:border-amber-500/70',
    badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    pill: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  rose: {
    key: 'rose',
    name: 'Rose',
    text: 'text-rose-600 dark:text-rose-400',
    textBold: 'text-rose-700 dark:text-rose-300',
    bgLight: 'bg-rose-50 dark:bg-rose-950/60',
    border: 'border-rose-200 dark:border-rose-800',
    borderStrong: 'border-rose-500/80 dark:border-rose-500/70',
    badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    pill: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  cyan: {
    key: 'cyan',
    name: 'Cyan',
    text: 'text-cyan-600 dark:text-cyan-400',
    textBold: 'text-cyan-700 dark:text-cyan-300',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/60',
    border: 'border-cyan-200 dark:border-cyan-800',
    borderStrong: 'border-cyan-500/80 dark:border-cyan-500/70',
    badge: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800',
    pill: 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  indigo: {
    key: 'indigo',
    name: 'Indigo',
    text: 'text-indigo-600 dark:text-indigo-400',
    textBold: 'text-indigo-700 dark:text-indigo-300',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/60',
    border: 'border-indigo-200 dark:border-indigo-800',
    borderStrong: 'border-indigo-500/80 dark:border-indigo-500/70',
    badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
    pill: 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  teal: {
    key: 'teal',
    name: 'Teal',
    text: 'text-teal-600 dark:text-teal-400',
    textBold: 'text-teal-700 dark:text-teal-300',
    bgLight: 'bg-teal-50 dark:bg-teal-950/60',
    border: 'border-teal-200 dark:border-teal-800',
    borderStrong: 'border-teal-500/80 dark:border-teal-500/70',
    badge: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
    pill: 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  fuchsia: {
    key: 'fuchsia',
    name: 'Fuchsia',
    text: 'text-fuchsia-600 dark:text-fuchsia-400',
    textBold: 'text-fuchsia-700 dark:text-fuchsia-300',
    bgLight: 'bg-fuchsia-50 dark:bg-fuchsia-950/60',
    border: 'border-fuchsia-200 dark:border-fuchsia-800',
    borderStrong: 'border-fuchsia-500/80 dark:border-fuchsia-500/70',
    badge: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800',
    pill: 'bg-fuchsia-100 dark:bg-fuchsia-950/70 text-fuchsia-800 dark:text-fuchsia-300',
    dot: 'bg-fuchsia-500',
  },
  orange: {
    key: 'orange',
    name: 'Orange',
    text: 'text-orange-600 dark:text-orange-400',
    textBold: 'text-orange-700 dark:text-orange-300',
    bgLight: 'bg-orange-50 dark:bg-orange-950/60',
    border: 'border-orange-200 dark:border-orange-800',
    borderStrong: 'border-orange-500/80 dark:border-orange-500/70',
    badge: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    pill: 'bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
};

const PALETTE_LIST: PersonColor[] = [
  COLOR_PALETTE.blue,
  COLOR_PALETTE.violet,
  COLOR_PALETTE.green,
  COLOR_PALETTE.amber,
  COLOR_PALETTE.rose,
  COLOR_PALETTE.cyan,
  COLOR_PALETTE.indigo,
  COLOR_PALETTE.teal,
  COLOR_PALETTE.fuchsia,
  COLOR_PALETTE.orange,
];

export const UNASSIGNED_PERSON_COLOR: PersonColor = {
  key: 'slate',
  name: 'Slate',
  text: 'text-slate-500 dark:text-slate-400',
  textBold: 'text-slate-600 dark:text-slate-400',
  bgLight: 'bg-slate-50 dark:bg-slate-800/60',
  border: 'border-slate-200 dark:border-slate-700',
  borderStrong: 'border-slate-300 dark:border-slate-700',
  badge: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
  pill: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  dot: 'bg-slate-400',
};

/**
 * Returns a stable PersonColor for any church leader or directory member.
 * Explicit assignments:
 * - Brother JB: Blue
 * - Brother Marius: Violet
 * - Brother Joshua: Green
 * - Brother Eric: Violet
 * - Brother Ronnie: Amber
 * Any other directory person: Deterministically assigned a distinct color from the curated palette.
 */
export function getPersonColor(rawName?: string | null): PersonColor {
  if (!rawName || !rawName.trim() || rawName.trim().toUpperCase() === 'TBD' || rawName.trim().toUpperCase() === 'TBA') {
    return UNASSIGNED_PERSON_COLOR;
  }

  // Normalize: lower case and strip title prefixes
  const clean = rawName
    .toLowerCase()
    .replace(/^(brother|bro\.?|sister|sis\.?|pastor|ptr\.?)\s+/i, '')
    .trim();

  // Explicit user-specified mappings
  if (clean === 'jb' || clean.includes('jb')) {
    return COLOR_PALETTE.blue;
  }
  if (clean === 'marius' || clean.includes('marius')) {
    return COLOR_PALETTE.violet;
  }
  if (clean === 'joshua' || clean.includes('joshua')) {
    return COLOR_PALETTE.green;
  }
  if (clean === 'eric' || clean.includes('eric')) {
    return COLOR_PALETTE.violet;
  }
  if (clean === 'ronnie' || clean.includes('ronnie')) {
    return COLOR_PALETTE.amber;
  }

  // Deterministic hash across palette for all other church directory names
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE_LIST.length;
  return PALETTE_LIST[index];
}
