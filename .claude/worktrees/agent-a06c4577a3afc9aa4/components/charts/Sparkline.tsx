'use client';

import { useDirection } from '@mantine/core';
import classes from './Sparkline.module.css';
import viz from './viz.module.css';

const WIDTH = 88;
const HEIGHT = 28;
const INSET = 3;

export interface SparklineProps {
  /** Chronological values. Mirrored for RTL so time still reads right to left. */
  data: number[];
  label: string;
}

/** 12-point trend line for stat tiles. De-emphasis hue, current point in accent. */
export default function Sparkline({ data, label }: SparklineProps) {
  const { dir } = useDirection();
  const rtl = dir === 'rtl';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const lastIndex = data.length - 1;

  const xAt = (index: number) => {
    const t = lastIndex > 0 ? index / lastIndex : 0.5;
    const inner = WIDTH - INSET * 2;
    return rtl ? WIDTH - INSET - t * inner : INSET + t * inner;
  };
  const yAt = (value: number) => HEIGHT - INSET - ((value - min) / span) * (HEIGHT - INSET * 2);

  const path = data
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${xAt(index)},${yAt(value)}`)
    .join(' ');

  return (
    <svg
      className={`${viz.viz} ${classes.svg}`}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
    >
      <path d={path} className={classes.line} />
      <circle cx={xAt(lastIndex)} cy={yAt(data[lastIndex])} r={3} className={classes.head} />
    </svg>
  );
}
