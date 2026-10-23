'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface AutoRefreshProps {
  /** How often the page's server data is re-read, in milliseconds. */
  intervalMs?: number;
}

/**
 * Keeps a server-rendered page fresh without a manual refresh.
 *
 * The support panel is the reason this exists: a customer's new question is
 * written from the storefront, so the supporter's list and thread would
 * otherwise sit on stale data until someone hit F5.
 *
 * `router.refresh()` re-runs the page's server components in place — the URL,
 * the client state and the scroll position are untouched, which is why this is
 * preferred over re-implementing each page's fetch in the browser.
 *
 * Polling a hidden tab is pure waste, so a tick while the document is not
 * visible is skipped; returning to the tab refreshes immediately instead of
 * waiting out the rest of the interval.
 */
export default function AutoRefresh({ intervalMs = 20_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    const timer = window.setInterval(refreshIfVisible, intervalMs);
    // Coming back to the tab is exactly when stale data is most obvious.
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router, intervalMs]);

  return null;
}
