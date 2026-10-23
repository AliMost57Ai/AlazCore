'use client';

import { Tooltip } from '@mantine/core';
import type { SeriesPoint } from '@/lib/stats';
import classes from './CategoryBars.module.css';
import viz from './viz.module.css';

export interface CategoryBarsProps {
  data: SeriesPoint[];
  formatValue: (value: number) => string;
  caption: string;
}

/**
 * Horizontal ranking bars.
 *
 * Built from HTML + CSS logical properties rather than SVG: `inset-inline` and
 * `border-*-end-radius` mirror for RTL on their own, so the bars grow from the
 * right in Persian and from the left in LTR with no direction-aware maths.
 */
export default function CategoryBars({ data, formatValue, caption }: CategoryBarsProps) {
  const max = Math.max(...data.map((point) => point.value));

  return (
    <figure className={`${viz.viz} ${classes.figure}`}>
      <ul className={classes.list}>
        {data.map((point) => (
          <li className={classes.row} key={point.label}>
            <div className={classes.head}>
              <span className={classes.label}>{point.label}</span>
              {/* Direct label at the tip: this chart has no y-axis to read. */}
              <span className={classes.value}>{formatValue(point.value)}</span>
            </div>

            <Tooltip
              label={`${point.label} — ${formatValue(point.value)}`}
              withArrow
              position="top"
            >
              <div className={classes.track}>
                <div
                  className={classes.bar}
                  style={{ inlineSize: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
              </div>
            </Tooltip>
          </li>
        ))}
      </ul>

      <table className={viz.srTable}>
        <caption>{caption}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
