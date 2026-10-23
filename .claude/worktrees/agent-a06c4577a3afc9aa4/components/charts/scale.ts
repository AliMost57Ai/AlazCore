/**
 * Shared scale helpers for the hand-rolled charts.
 *
 * No charting dependency: the whole dashboard needs one area chart and one bar
 * chart, and both have to mirror for RTL — which most libraries do not do for
 * the time axis.
 */

/** Rounds a rough interval up to the nearest "clean" number a reader expects. */
function niceStep(rough: number): number {
  if (rough <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const candidates = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const chosen = candidates.find((step) => normalized <= step + 1e-9) ?? 10;

  return chosen * magnitude;
}

export interface Scale {
  /** Top of the domain — always a multiple of `step`. */
  top: number;
  ticks: number[];
}

/**
 * Builds a zero-based scale with clean tick values. Area and bar charts are
 * zero-baselined by definition: the fill encodes magnitude, so a truncated axis
 * misstates it.
 */
export default function buildScale(max: number, intervals = 5): Scale {
  if (!Number.isFinite(max) || max <= 0) {
    return { top: 1, ticks: [0, 1] };
  }

  const step = niceStep(max / intervals);

  return {
    top: step * intervals,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => index * step),
  };
}
