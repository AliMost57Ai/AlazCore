'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { IconHeadset, IconX } from '@tabler/icons-react';
import {
  ActionIcon,
  Box,
  Drawer,
  Group,
  Indicator,
  Paper,
  Text,
  Transition,
  type MantineTransition,
} from '@mantine/core';
import SupportChat from '@/components/support/SupportChat';
import type { SupportWidgetConfig, SupportWidgetPosition } from '@/lib/support-status';

export interface SupportChatWidgetProps {
  /** The signed-in customer's name — null means the visitor is a guest. */
  customerName: string | null;
  /** Greeting from تنظیمات ← پشتیبانی. */
  welcome: string;
  /** Where and how to show the button — see resolveSupportWidgetConfig. */
  config: SupportWidgetConfig;
}

/** How long the entrance animation and the greeting bubble take. */
const ENTER_DURATION = 220;
const NOTICE_DURATION = 150;

/**
 * The greeting bubble is a once-per-session hello, not a per-page one: without
 * this a customer walking from the landing page into a product page would be
 * greeted again on every navigation.
 */
const NOTICE_SEEN_KEY = 'alaz:support-notice-seen';

function hasSeenNotice(): boolean {
  try {
    return window.sessionStorage.getItem(NOTICE_SEEN_KEY) === '1';
  } catch {
    // Private mode or storage disabled — greet again rather than crash.
    return false;
  }
}

function markNoticeSeen(): void {
  try {
    window.sessionStorage.setItem(NOTICE_SEEN_KEY, '1');
  } catch {
    // Ignored: the worst case is one extra greeting.
  }
}

/**
 * Which corner of the screen the button hugs, as physical offsets. Physical
 * `left`/`right` rather than a logical inset on purpose: the admin picks a
 * corner of the screen, and `insetInlineEnd` would mirror it in an LTR page.
 */
function cornerStyle(position: SupportWidgetPosition): CSSProperties {
  switch (position) {
    case 'bottom-right':
      return { right: 20, bottom: 20 };
    case 'top-left':
      return { left: 20, top: 20 };
    case 'top-right':
      return { right: 20, top: 20 };
    case 'bottom-left':
    default:
      return { left: 20, bottom: 20 };
  }
}

/**
 * The chosen animation as a Mantine transition. `slide` and `pop` are corner
 * aware: a button anchored to the bottom of the screen slides and pops up into
 * place, one anchored to the top comes down. `null` means «no animation».
 */
function transitionFor(
  animation: SupportWidgetConfig['animation'],
  position: SupportWidgetPosition
): MantineTransition | null {
  switch (animation) {
    case 'none':
      return null;
    case 'scale':
      return 'scale';
    case 'slide':
      return position.startsWith('top') ? 'slide-down' : 'slide-up';
    case 'pop':
      return `pop-${position}`;
    case 'fade':
    default:
      return 'fade';
  }
}

/**
 * The floating support button + chat drawer on the storefront.
 *
 * Rendered only for guests and customers — staff answer tickets from the panel,
 * so the storefront page never mounts it for them. Because the button is
 * `position: fixed` it sits outside every theme's markup: the storefront pages
 * render it as a sibling of the theme component, and no theme file changes.
 *
 * Appearance is fixed; only the *arrival* is configurable (تنظیمات ← پشتیبانی):
 * which corner, how long to wait after load, which entrance animation, and
 * whether a greeting bubble shows above the button and closes itself.
 */
export default function SupportChatWidget({
  customerName,
  welcome,
  config,
}: SupportChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  // The button is not mounted until the delay has passed, so the entrance
  // animation plays when it arrives instead of once on an invisible element.
  const [shown, setShown] = useState(config.delayMs <= 0);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (config.delayMs <= 0) {
      setShown(true);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), config.delayMs);
    return () => window.clearTimeout(timer);
  }, [config.delayMs]);

  useEffect(() => {
    if (!shown || !config.noticeEnabled || hasSeenNotice()) {
      return;
    }
    // Marked before it is shown: the greeting must not reappear on the next
    // page the visitor opens, whether or not they read it.
    markNoticeSeen();
    setNotice(true);
  }, [shown, config.noticeEnabled]);

  useEffect(() => {
    if (!notice || config.noticeMs <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(false), config.noticeMs);
    return () => window.clearTimeout(timer);
  }, [notice, config.noticeMs]);

  function openChat() {
    setNotice(false);
    setOpen(true);
  }

  const { position } = config;
  const isBottom = position.startsWith('bottom');
  const transition = transitionFor(config.animation, position);

  const button: ReactNode = (
    <Indicator
      disabled={unread === 0}
      label={unread > 9 ? '۹+' : String(unread)}
      size={18}
      color="red"
      offset={6}
    >
      <ActionIcon
        size={52}
        radius="xl"
        variant="filled"
        color="teal"
        aria-label="گفتگو با پشتیبانی"
        onClick={openChat}
      >
        <IconHeadset size={26} />
      </ActionIcon>
    </Indicator>
  );

  return (
    <>
      <Box
        style={{
          position: 'fixed',
          ...cornerStyle(position),
          zIndex: 300,
          // The greeting stacks against the screen edge: it sits above the
          // button in the bottom corners and below it in the top ones. Both
          // arrangements come from one order in the DOM — `column-reverse`
          // flips which end of the block the first child lands on.
          display: 'flex',
          flexDirection: isBottom ? 'column' : 'column-reverse',
          alignItems: position.endsWith('left') ? 'flex-start' : 'flex-end',
          gap: 10,
        }}
      >
        <Transition mounted={notice} transition="fade" duration={NOTICE_DURATION}>
          {(styles) => (
            <Paper
              withBorder
              shadow="md"
              radius="md"
              p="sm"
              maw={240}
              role="button"
              tabIndex={0}
              aria-label="باز کردن گفتگو با پشتیبانی"
              onClick={openChat}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openChat();
                }
              }}
              style={{ ...styles, cursor: 'pointer' }}
            >
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Text size="xs" style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>
                  {welcome}
                </Text>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="بستن پیام"
                  onClick={(event) => {
                    // The bubble opens the chat; the close button only closes.
                    event.stopPropagation();
                    setNotice(false);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          )}
        </Transition>

        {transition ? (
          <Transition mounted={shown} transition={transition} duration={ENTER_DURATION}>
            {(styles) => <Box style={styles}>{button}</Box>}
          </Transition>
        ) : shown ? (
          button
        ) : null}
      </Box>

      <Drawer
        opened={open}
        onClose={() => setOpen(false)}
        position="right"
        size="md"
        // Kept mounted while closed so the unread badge keeps updating: the
        // chat panel owns the (cheap) poll, and re-mounting it on every open
        // would restart it from scratch.
        keepMounted
        // A plain string, like AuthModal: the drawer already wraps its title in
        // an <h2>, so a <Title> here nested a heading inside a heading and made
        // React warn about invalid markup. The weight is what the old <Title>
        // showed, kept through the styles API rather than a nested element.
        title="پشتیبانی آنلاین"
        styles={{ title: { fontWeight: 600 } }}
        closeButtonProps={{ 'aria-label': 'بستن', icon: <IconX size={18} /> }}
      >
        <Text size="xs" c="dimmed" mb="sm">
          گفتگوی شما با پشتیبان سایت — پاسخ‌ها همین‌جا نمایش داده می‌شوند.
        </Text>
        <SupportChat
          customerName={customerName}
          welcome={welcome}
          onUnreadChange={setUnread}
          height={360}
        />
      </Drawer>
    </>
  );
}
