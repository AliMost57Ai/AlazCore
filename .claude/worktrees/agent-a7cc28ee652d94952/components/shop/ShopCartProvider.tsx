'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OrderItem } from '@/lib/shop-orders';

export interface CartItem {
  productId: string;
  /** Null = the plain product, no variant. */
  variantId: string | null;
  slug: string;
  /** Product name, without the variant suffix. */
  name: string;
  variantName: string | null;
  /** Unit price at add-to-cart time (re-verified server-side at checkout). */
  unitPrice: number;
  qty: number;
  /** Stock when the item was added — the drawer caps the stepper at this. */
  maxStock: number;
}

interface ShopCartContextValue {
  items: CartItem[];
  /** How many goods the local cart holds (sum of quantities) — part of the header badge. */
  count: number;
  total: number;
  /**
   * How many goods sit in the signed-in customer's unpaid order — they stay
   * part of the basket until the order is paid, so they belong in the badge
   * (and in the drawer) even after the page was left mid-checkout.
   */
  pendingCount: number;
  /** Re-reads the unpaid order — after sign-in, order placement, or item removal. */
  refreshPending: () => void;
  /** Adds an item (merges with an existing line when product+variant match). */
  add: (item: CartItem) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
}

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

const STORAGE_KEY = 'shop-cart';

function sameLine(a: CartItem, productId: string, variantId: string | null): boolean {
  return a.productId === productId && a.variantId === variantId;
}

/** Sanity-checks a localStorage payload before trusting it as a cart. */
function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.productId === 'string' &&
        typeof item.slug === 'string' &&
        typeof item.name === 'string' &&
        typeof item.unitPrice === 'number' &&
        typeof item.qty === 'number' &&
        typeof item.maxStock === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Cart state for the storefront. Kept in localStorage (per browser, no
 * account needed to fill a cart) — the authoritative price/stock check happens
 * server-side when the order is actually placed.
 */
export function ShopCartProvider({ children }: { children: ReactNode }) {
  // Start empty on the server and on first paint; load from storage in an
  // effect so SSR and hydration always agree.
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    try {
      setItems(parseStoredCart(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      // Storage can be unavailable (private mode) — an empty cart is fine.
    }
    setLoaded(true);
  }, []);

  // The unpaid order's goods count — fetched once on mount (a signed-out
  // caller simply gets a 401 → zero) and re-fetched after sign-in, order
  // placement, or item removal via refreshPending.
  const refreshPending = useCallback(() => {
    fetch('/api/orders/pending')
      .then(async (response) => {
        if (!response.ok) {
          setPendingCount(0);
          return;
        }
        const payload = (await response.json()) as { order: { items: OrderItem[] } | null };
        setPendingCount(
          payload.order ? payload.order.items.reduce((sum, item) => sum + item.qty, 0) : 0
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    refreshPending();
  }, [loaded, refreshPending]);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // See above: best-effort persistence only.
    }
  }, [items, loaded]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => {
      const existing = current.find((line) => sameLine(line, item.productId, item.variantId));
      if (existing) {
        return current.map((line) =>
          sameLine(line, item.productId, item.variantId)
            ? { ...line, qty: Math.min(line.qty + item.qty, line.maxStock) }
            : line
        );
      }
      return [...current, item];
    });
  }, []);

  const setQty = useCallback((productId: string, variantId: string | null, qty: number) => {
    setItems((current) =>
      current.map((line) =>
        sameLine(line, productId, variantId)
          ? { ...line, qty: Math.min(Math.max(1, qty), line.maxStock) }
          : line
      )
    );
  }, []);

  const remove = useCallback((productId: string, variantId: string | null) => {
    setItems((current) => current.filter((line) => !sameLine(line, productId, variantId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<ShopCartContextValue>(() => {
    const count = items.reduce((sum, line) => sum + line.qty, 0);
    const total = items.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
    return { items, count, total, pendingCount, refreshPending, add, setQty, remove, clear };
  }, [items, pendingCount, refreshPending, add, setQty, remove, clear]);

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart(): ShopCartContextValue {
  const context = useContext(ShopCartContext);
  if (!context) {
    throw new Error('useShopCart must be used inside <ShopCartProvider>');
  }
  return context;
}
