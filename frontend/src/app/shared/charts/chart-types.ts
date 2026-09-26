/**
 * Shared types and helpers for the chart components.
 *
 * The charts are hand-rolled inline SVG rather than a charting library: the
 * project has no chart dependency, every chart here is a simple form, and
 * inline SVG keeps them themeable from the same CSS variables as the rest of
 * the UI and readable by screen readers.
 */

export interface Point {
  label: string;
  value: number;
}

export interface Series {
  name: string;
  colour: string;
  points: Point[];
  /** Draw a filled area beneath the line. */
  area?: boolean;
  /** Render as a dashed line — used for targets and reference levels. */
  dashed?: boolean;
}

export interface Slice {
  label: string;
  value: number;
  colour: string;
}

/** The categorical palette. Ordered so adjacent series stay distinguishable. */
export const PALETTE = [
  '#2f6fed',
  '#17794c',
  '#a4650a',
  '#b3261e',
  '#6b4ea8',
  '#0e7490',
  '#9a3412',
  '#4a5464',
];

/** Semantic colours, matched to the status pill tones. */
export const TONE = {
  success: '#17794c',
  warn: '#a4650a',
  danger: '#b3261e',
  info: '#14568f',
  accent: '#2f6fed',
  neutral: '#8a93a3',
};

/** Risk level → colour, so risk reads the same on every chart. */
export const RISK_COLOURS: Record<string, string> = {
  Low: TONE.success,
  Medium: TONE.warn,
  High: '#d97706',
  Critical: TONE.danger,
};

export function colourFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

/** Formats a number compactly for axis ticks (12.4k, 1.2M). */
export function compact(value: number): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (magnitude >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  if (magnitude >= 100 || Number.isInteger(value)) {
    return String(Math.round(value));
  }

  return value.toFixed(1);
}

/**
 * Picks round axis bounds and tick positions.
 *
 * Charts that scale straight to the data maximum produce axis labels like
 * "8,347", so the maximum is rounded up to a clean step first.
 */
export function niceScale(
  min: number,
  max: number,
  tickCount = 4,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const base = Number.isFinite(max) && max !== 0 ? Math.abs(max) : 1;
    min = 0;
    max = base * 1.2;
  }

  const span = max - min || 1;
  const rawStep = span / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  let step: number;
  if (normalised <= 1) step = 1;
  else if (normalised <= 2) step = 2;
  else if (normalised <= 2.5) step = 2.5;
  else if (normalised <= 5) step = 5;
  else step = 10;

  step *= magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step / 1000; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return { min: niceMin, max: niceMax, ticks };
}

/** Turns "2026-03" into "Mar 26" for axis labels. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');

  if (!year || !month) {
    return key;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  });
}
