'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { useDirection } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import type { SeriesPoint } from '@/lib/stats';
import buildScale from './scale';
import classes from './RevenueChart.module.css';
import viz from './viz.module.css';

const PAD_TOP = 22;
const PAD_BOTTOM = 30;
/** Side that carries the y-axis labels — right in RTL, left in LTR. */
const AXIS_GUTTER = 44;
const EDGE_GUTTER = 16;

export interface RevenueChartProps {
  data: SeriesPoint[];
  /** Formats a y-axis tick. Keep it short — the unit belongs in `unitLabel`. */
  formatTick: (value: number) => string;
  /** Formats the tooltip and endpoint value, with units. */
  formatValue: (value: number) => string;
  /** Axis unit, rendered once above the plot instead of on every tick. */
  unitLabel: string;
  /** Accessible name for the figure. */
  caption: string;
}

export default function RevenueChart({
  data,
  formatTick,
  formatValue,
  unitLabel,
  caption,
}: RevenueChartProps) {
  const { dir } = useDirection();
  const { ref, width } = useElementSize();
  const [active, setActive] = useState<number | null>(null);

  const rtl = dir === 'rtl';
  const height = width > 0 && width < 480 ? 200 : 264;
  const ready = width >= 80;

  const scale = useMemo(() => buildScale(Math.max(...data.map((point) => point.value))), [data]);

  const geometry = useMemo(() => {
    const left = rtl ? EDGE_GUTTER : AXIS_GUTTER;
    const right = width - (rtl ? AXIS_GUTTER : EDGE_GUTTER);
    const top = PAD_TOP;
    const bottom = height - PAD_BOTTOM;
    const plotWidth = Math.max(1, right - left);
    const plotHeight = Math.max(1, bottom - top);
    const lastIndex = data.length - 1;

    // Mirroring the x-axis is the whole point: in RTL, time reads right to left.
    const xAt = (index: number) => {
      const t = lastIndex > 0 ? index / lastIndex : 0.5;
      return rtl ? right - t * plotWidth : left + t * plotWidth;
    };
    const yAt = (value: number) => bottom - (value / scale.top) * plotHeight;

    return { left, right, top, bottom, plotWidth, plotHeight, lastIndex, xAt, yAt };
  }, [data.length, height, rtl, scale.top, width]);

  const { left, right, top, bottom, plotWidth, lastIndex, xAt, yAt } = geometry;

  const linePath = useMemo(
    () =>
      data
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(point.value)}`)
        .join(' '),
    [data, xAt, yAt]
  );

  const areaPath = `${linePath} L${xAt(lastIndex)},${bottom} L${xAt(0)},${bottom} Z`;

  // Thin the x labels on narrow screens, counting back from the last point so
  // the most recent month is always labelled.
  const labelEvery = width < 420 ? 4 : width < 660 ? 2 : 1;

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    // getBoundingClientRect is always physical (LTR), so no mirroring here —
    // only the inversion below is direction-aware.
    const x = event.clientX - rect.left;
    const t = rtl ? (right - x) / plotWidth : (x - left) / plotWidth;
    const index = Math.round(t * lastIndex);

    setActive(Math.min(lastIndex, Math.max(0, index)));
  }

  const activePoint = active === null ? null : data[active];
  const lastPoint = data[lastIndex];

  // Keep the endpoint label clear of the top edge; flip it below the marker if
  // there isn't room above.
  const endLabelY =
    yAt(lastPoint.value) - 14 < top + 4 ? yAt(lastPoint.value) + 22 : yAt(lastPoint.value) - 14;

  return (
    <figure className={`${viz.viz} ${classes.figure}`} ref={ref}>
      <span className={classes.unit}>{unitLabel}</span>

      <div className={classes.plot} style={{ height }}>
        {ready ? (
          <>
            <svg
              width={width}
              height={height}
              className={classes.svg}
              role="img"
              aria-label={caption}
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setActive(null)}
            >
              {/* Gridlines and ticks first — recessive, behind the data. */}
              {scale.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={left}
                    x2={right}
                    y1={yAt(tick)}
                    y2={yAt(tick)}
                    className={tick === 0 ? classes.baseline : classes.gridline}
                  />
                  <text
                    x={rtl ? right + 8 : left - 8}
                    y={yAt(tick) + 4}
                    textAnchor={rtl ? 'start' : 'end'}
                    className={classes.axisText}
                  >
                    {formatTick(tick)}
                  </text>
                </g>
              ))}

              {data.map((point, index) =>
                (lastIndex - index) % labelEvery === 0 ? (
                  <text
                    key={point.label}
                    x={xAt(index)}
                    y={bottom + 20}
                    textAnchor="middle"
                    className={classes.axisText}
                  >
                    {point.label}
                  </text>
                ) : null
              )}

              <path d={areaPath} className={classes.area} />
              <path d={linePath} className={classes.line} />

              {/* Crosshair for the hovered point. */}
              {activePoint ? (
                <>
                  <line
                    x1={xAt(active!)}
                    x2={xAt(active!)}
                    y1={top}
                    y2={bottom}
                    className={classes.crosshair}
                  />
                  <circle
                    cx={xAt(active!)}
                    cy={yAt(activePoint.value)}
                    r={5}
                    className={classes.marker}
                  />
                </>
              ) : null}

              {/* Endpoint marker + the one direct label this chart gets. */}
              <circle
                cx={xAt(lastIndex)}
                cy={yAt(lastPoint.value)}
                r={4.5}
                className={classes.marker}
              />
              <text
                x={xAt(lastIndex)}
                y={endLabelY}
                textAnchor={rtl ? 'start' : 'end'}
                className={classes.endLabel}
              >
                {formatValue(lastPoint.value)}
              </text>
            </svg>

            {activePoint ? (
              <div
                className={classes.tooltip}
                style={{
                  left: Math.min(Math.max(xAt(active!), 76), Math.max(76, width - 76)),
                  top: Math.max(6, yAt(activePoint.value) - 56),
                }}
              >
                <span className={classes.tooltipLabel}>{activePoint.label}</span>
                <span className={classes.tooltipValue}>{formatValue(activePoint.value)}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

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
