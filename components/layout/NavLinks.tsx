'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, Box, NavLink, Stack } from '@mantine/core';
import { enNumber } from '@/lib/format';
import { ADMIN_ONLY_HREFS, ALWAYS_VISIBLE_HREFS, hasMenuPermission } from '@/lib/nav-permissions';
import { isGroup, NAV_ENTRIES, type NavEntry, type NavItem } from './nav-items';
import classes from './NavLinks.module.css';

export interface NavLinksProps {
  /** Closes the mobile navbar after a tap. */
  onNavigate?: () => void;
  /** Signed-in menu permissions ('*' = everything); omitted shows all. */
  perms?: string[];
  /** Live per-href badge counts from the site DB (server layout computes). */
  badges?: Record<string, number>;
  /**
   * hrefهایی که فیچرِ خاموش‌شده در Core باید همیشه پنهان بمانند — حتی برای
   * ادمین با wildcard (مثل تحویل حضوری وقتی پنل Core آن را خاموش کرده).
   */
  disabledHrefs?: string[];
}

/** Every routable href in the nav (top-level items and group children). */
const ALL_HREFS: string[] = NAV_ENTRIES.flatMap((entry) =>
  isGroup(entry) ? entry.children.map((child) => child.href) : [entry.href]
);

/** The single most-specific match wins — on /settings/payment only that row
 *  lights up, not the shorter /settings row next to it. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) {
        best = href;
      }
    }
  }
  return best;
}

/** A nav href renders when it is always-visible or granted a view permission;
 *  admin-only pages additionally need the wildcard — or the bare href in the
 *  list, which is how Core-plan menus (آزادشده توسط پنل Core) surface them
 *  without handing staff the wildcard. Matches the page/API guards exactly. */
function entryVisible(href: string, perms?: string[]): boolean {
  if (!perms || perms.includes('*')) {
    return true;
  }
  if (ALWAYS_VISIBLE_HREFS.includes(href)) {
    return true;
  }
  if (ADMIN_ONLY_HREFS.includes(href)) {
    return perms.includes(href);
  }
  return hasMenuPermission(perms, href, 'view');
}

/** Drops disallowed rows, then any group left without children. */
function filterEntries(
  entries: NavEntry[],
  perms?: string[],
  disabledHrefs?: string[]
): NavEntry[] {
  const disabled = new Set(disabledHrefs ?? []);
  const visible = (href: string): boolean => !disabled.has(href) && entryVisible(href, perms);
  return entries
    .map((entry) =>
      isGroup(entry)
        ? { ...entry, children: entry.children.filter((child) => visible(child.href)) }
        : entry
    )
    .filter((entry) => (isGroup(entry) ? entry.children.length > 0 : visible(entry.href)));
}

/**
 * سایدبار داشبورد مالک — همان زبان بصری سایدبار پنل Core: NavLink تاشو با
 * حالت فعال pill برند، زیرمنوی تورفته با تورفتگی و آیکن ریزتر. خوانایی
 * اولویت اول است؛ رنگ برند فقط کارکردی (وضعیت فعال).
 */
export default function NavLinks({ onNavigate, perms, badges, disabledHrefs }: NavLinksProps) {
  const pathname = usePathname();
  const entries = filterEntries(NAV_ENTRIES, perms, disabledHrefs);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // Groups whose children match the current route start open.
    const initial: Record<string, boolean> = {};
    for (const entry of entries) {
      if (isGroup(entry) && entry.children.some((child) => pathname.startsWith(child.href))) {
        initial[entry.id] = true;
      }
    }
    return initial;
  });

  const active = activeHref(pathname);

  function plainLink(item: NavItem, key?: string) {
    return (
      <NavLink
        key={key ?? item.href}
        component={Link}
        href={item.href}
        label={item.label}
        leftSection={<item.icon size={18} stroke={1.6} />}
        active={active === item.href}
        onClick={onNavigate}
        variant="light"
        color="brand"
        rightSection={
          badges?.[item.href] ? (
            <Badge size="sm" variant="light" circle>
              {enNumber(badges[item.href])}
            </Badge>
          ) : null
        }
      />
    );
  }

  return (
    <Stack component="nav" aria-label="ناوبری اصلی" gap={4} className={classes.navList}>
      {entries.map((entry) => {
        if (!isGroup(entry)) {
          return plainLink(entry);
        }

        const childActive = entry.children.some((child) => active === child.href);
        const isOpen = open[entry.id] ?? false;

        return (
          <NavLink
            key={entry.id}
            label={entry.label}
            leftSection={<entry.icon size={18} stroke={1.6} />}
            variant="light"
            color="brand"
            data-active={childActive || undefined}
            aria-expanded={isOpen}
            onClick={() => setOpen((state) => ({ ...state, [entry.id]: !state[entry.id] }))}
            rightSection={
              <Badge size="sm" variant="light" circle>
                {'<'}
              </Badge>
            }
          >
            <Box className={classes.groupChildren}>
              {entry.children.map((child) => (
                <NavLink
                  key={child.href}
                  component={Link}
                  href={child.href}
                  label={child.label}
                  leftSection={<child.icon size={15} stroke={1.6} />}
                  active={active === child.href}
                  onClick={onNavigate}
                  variant="subtle"
                  color="brand"
                  style={{ paddingRight: 30 }}
                  rightSection={
                    badges?.[child.href] ? (
                      <Badge size="sm" variant="light" circle>
                        {enNumber(badges[child.href])}
                      </Badge>
                    ) : null
                  }
                />
              ))}
            </Box>
          </NavLink>
        );
      })}
    </Stack>
  );
}
