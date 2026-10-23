'use client';

import { useEffect, useState } from 'react';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';

/**
 * قلب علاقه‌مندی — جزیره کلاینت کوچکی که روی کارت سرور و صفحه محصول می‌نشیند.
 * شناسه‌های علاقه‌مندی یک بار در هر صفحه (کش ماژول‌سطح) گرفته می‌شود تا ده‌ها
 * کارت، ده‌ها درخواست نزنند. مهمان (۴۰۱) با کلیک به /login?next=/ می‌رود.
 */

let favoritesPromise: Promise<string[] | null> | null = null;

/** یک fetch مشترک برای همه قلب‌های صفحه — null یعنی مهمان/خطا. */
function loadFavoriteIds(): Promise<string[] | null> {
  if (!favoritesPromise) {
    favoritesPromise = (async () => {
      try {
        const response = await fetch('/api/favorites/ids', { cache: 'no-store' });
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as { ids?: string[] };
        return data.ids ?? [];
      } catch {
        return null;
      }
    })();
  }
  return favoritesPromise;
}

export interface FavoriteButtonProps {
  productId: string;
  /** نام کالا برای متن اعلان. */
  productName?: string;
  /** اندازه روی کارت کوچک‌تر است. */
  size?: 'sm' | 'md';
}

export default function FavoriteButton({ productId, productName, size = 'md' }: FavoriteButtonProps) {
  const [fav, setFav] = useState(false);
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadFavoriteIds().then((ids) => {
      if (cancelled || ids === null) {
        return;
      }
      setFav(ids.includes(productId));
      setKnown(true);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function toggle() {
    if (busy) {
      return;
    }
    // مهمان — پاسخ ۴۰۱ در loadFavoriteIds هم دیده می‌شود؛ اینجا هم گارد است.
    if (!known) {
      window.location.href = '/login?next=/';
      return;
    }
    setBusy(true);
    const next = !fav;
    setFav(next); // optimistic — خطا برمی‌گردد.
    try {
      const response = next
        ? await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          })
        : await fetch(`/api/favorites?productId=${encodeURIComponent(productId)}`, {
            method: 'DELETE',
          });
      if (!response.ok) {
        setFav(!next);
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          message: payload.error ?? 'تغییر علاقه‌مندی ناموفق بود.',
          color: 'red',
        });
        return;
      }
      // کش صفحه را هم به‌روز نگه دار تا قلب‌های هنوز سوارنشده هم‌نظر شوند.
      favoritesPromise = Promise.resolve(
        next
          ? loadFavoriteIds().then((ids) => (ids ? [...new Set([...ids, productId])] : ids))
          : loadFavoriteIds().then((ids) => (ids ? ids.filter((id) => id !== productId) : ids))
      );
      if (next) {
        notifications.show({
          message: productName ? `«${productName}» به علاقه‌مندی‌ها اضافه شد.` : 'به علاقه‌مندی‌ها اضافه شد.',
          color: 'pink',
        });
      }
    } catch {
      setFav(!next);
      notifications.show({ message: 'تغییر علاقه‌مندی ناموفق بود.', color: 'red' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tooltip
      label={fav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
      withArrow
      openDelay={300}
    >
      <ActionIcon
        variant={fav ? 'light' : 'default'}
        color="pink"
        size={size === 'sm' ? 'sm' : 'lg'}
        radius="md"
        aria-label={fav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
        aria-pressed={fav}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void toggle();
        }}
      >
        {fav ? <IconHeartFilled size={size === 'sm' ? 15 : 18} /> : <IconHeart size={size === 'sm' ? 15 : 18} />}
      </ActionIcon>
    </Tooltip>
  );
}
