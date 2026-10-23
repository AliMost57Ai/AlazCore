'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconChevronDown } from '@tabler/icons-react';
import { Badge, Box, Stack, UnstyledButton } from '@mantine/core';
import { faNumber } from '@/lib/format';
import {
  ADMIN_ONLY_HREFS,
  ADMIN_ONLY_ROW_HREFS,
  ALWAYS_VISIBLE_HREFS,
  hasMenuPermission,
} from '@/lib/nav-permissions';
import { isGroup, NAV_ENTRIES, type NavEntry, type NavItem } from './nav-items';
import classes from './NavLinks.module.css';

export interface NavLinksProps {
  /** Closes the mobile navbar after a tap. */
  onNavigate?: () => void;
  /** Signed-in menu permissions ('*' = everything); omitted shows all. */
  perms?: string[];
}

function NavItemLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={classes.link}
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      <item.icon size={18} stroke={1.6} className={classes.icon} />
      <span className={classes.label}>{item.label}</span>
      {item.badge ? (
        <Badge size="sm" variant="light" circle>
          {faNumber(item.badge)}
        </Badge>
      ) : null}
    </Link>
  );
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
 *  admin-only pages additionally need the wildcard. Matches the page/API
 *  guards exactly. */
function entryVisible(href: string, perms?: string[]): boolean {
  // No list at all means "no restriction" (Storybook, probes) — show the lot.
  if (!perms) {
    return true;
  }
  if (perms.includes('*')) {
    return true;
  }
  // Rows kept for administrators only, checked before the always-visible list:
  // that list is about who may *open* a page, which is not the same as who
  // should be offered a link to it.
  if (ADMIN_ONLY_ROW_HREFS.includes(href)) {
    return false;
  }
  if (ALWAYS_VISIBLE_HREFS.includes(href)) {
    return true;
  }
  if (ADMIN_ONLY_HREFS.includes(href)) {
    return false;
  }
  return hasMenuPermission(perms, href, 'view');
}

/** Drops disallowed rows, then any group left without children. */
function filterEntries(entries: NavEntry[], perms?: string[]): NavEntry[] {
  return entries
    .map((entry) =>
      isGroup(entry)
        ? { ...entry, children: entry.children.filter((child) => entryVisible(child.href, perms)) }
        : entry
    )
    .filter((entry) =>
      isGroup(entry) ? entry.children.length > 0 : entryVisible(entry.href, perms)
    );
}

/**
 * The admin sidebar navigation. Groups (کالا, مالی, وبسایت, تنظیمات) render a
 * collapsible parent row with their sub-items; plain items link directly. A
 * group whose current route matches one of its children starts expanded.
 *
 * Top-level rows are plain; an open group's sub-menu drops into ONE faint
 * bordered box hugging its parent row — the box plus the indentation is what
 * marks the sub-items as belonging to that menu.
 */
export default function NavLinks({ onNavigate, perms }: NavLinksProps) {
  const pathname = usePathname();
  const entries = filterEntries(NAV_ENTRIES, perms);
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

  return (
    <Stack component="nav" aria-label="ناوبری اصلی" gap={2} className={classes.navList}>
      {entries.map((entry) => {
        if (!isGroup(entry)) {
          return (
            <NavItemLink
              key={entry.href}
              item={entry}
              active={active === entry.href}
              onNavigate={onNavigate}
            />
          );
        }

        const childActive = entry.children.some((child) => active === child.href);
        const isOpen = open[entry.id] ?? false;

        return (
          <Box key={entry.id} className={classes.group}>
            <UnstyledButton
              className={classes.groupHead}
              data-active={childActive || undefined}
              aria-expanded={isOpen}
              onClick={() => setOpen((state) => ({ ...state, [entry.id]: !state[entry.id] }))}
            >
              <entry.icon size={20} stroke={1.6} className={classes.icon} />
              <span className={classes.label}>{entry.label}</span>
              {entry.badge ? (
                <Badge size="sm" variant="light" circle>
                  {faNumber(entry.badge)}
                </Badge>
              ) : null}
              <span
                className={`${classes.chevron} ${isOpen ? classes.chevronOpen : ''}`}
                aria-hidden="true"
              >
                <IconChevronDown size={16} stroke={2} />
              </span>
            </UnstyledButton>

            {isOpen ? (
              <Box className={classes.groupChildren}>
                {entry.children.map((child) => (
                  <NavItemLink
                    key={child.href}
                    item={child}
                    active={active === child.href}
                    onNavigate={onNavigate}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}
