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
import type { SupportWidgetConfig, SupportWidgetPosition } from '@/lib/support-widget';

export interface SupportChatWidgetProps {
  /** نام مشتری واردشده — null یعنی بازدیدکننده مهمان است. */
  customerName: string | null;
  /** خوش‌آمد از تنظیمات ← پشتیبانی. */
  welcome: string;
  /** کجا و چطور نمایش داده شود — خروجی resolveSupportWidgetConfig. */
  config: SupportWidgetConfig;
}

/** مدت انیمیشن ورود و حباب خوش‌آمد. */
const ENTER_DURATION = 220;
const NOTICE_DURATION = 150;

/**
 * حباب خوش‌آمد یک‌بار-در-هر-نشست است نه هر-صفحه: بدون این، مشتری‌ای که از
 * لندینگ به صفحه محصول می‌رود در هر ناوبری دوباره خوش‌آمد می‌گیرد.
 */
const NOTICE_SEEN_KEY = 'alaz:support-notice-seen';

function hasSeenNotice(): boolean {
  try {
    return window.sessionStorage.getItem(NOTICE_SEEN_KEY) === '1';
  } catch {
    // حالت خصوصی یا storage غیرفعال — دوباره خوش‌آمد بگو تا نشکند.
    return false;
  }
}

function markNoticeSeen(): void {
  try {
    window.sessionStorage.setItem(NOTICE_SEEN_KEY, '1');
  } catch {
    // نادیده: بدترین حالت یک خوش‌آمد اضافه است.
  }
}

/**
 * کدام گوشه صفحه — به‌صورت آفست فیزیکی. left/right فیزیکی و نه inset منطقی
 * به‌عمد: ادمین گوشه صفحه را انتخاب می‌کند و insetInlineEnd در صفحه LTR
 * آینه می‌شد.
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
 * انیمیشن انتخابی به‌صورت Transition منتن. slide و pop گوشه-آگاهند: دکمه
 * لنگرشده به پایین از پایین سر می‌خورد و پاپ می‌شود، لنگر به بالا از بالا
 * می‌آید. null = «بدون انیمیشن».
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
 * دکمه شناور پشتیبانی + کشوی چت روی فروشگاه — پورت نسخه مرجع.
 *
 * فقط برای مهمان و مشتری رندر می‌شود — پرسنل تیکت‌ها را از پنل جواب می‌دهند و
 * صفحه فروشگاه برایشان آن را سوار نمی‌کند. چون دکمه position: fixed است بیرون
 * از مارک‌آپ هر تمی می‌نشیند: صفحات فروشگاه آن را خواهرِ کامپوننت تم رندر
 * می‌کنند و هیچ فایل تمی تغییر نمی‌کند.
 *
 * ظاهر ثابت است؛ فقط «ورود» قابل تنظیم است (تنظیمات ← پشتیبانی): کدام گوشه،
 * چند ثانیه بعد از لود، کدام انیمیشن ورود، و آیا حباب خوش‌آمد بالای دکمه
 * نشان داده شود و خودش ببندد.
 */
export default function SupportChatWidget({
  customerName,
  welcome,
  config,
}: SupportChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  // دکمه تا گذشتن تأخیر مونت نمی‌شود تا انیمیشن ورود هنگام رسیدنش پخش شود،
  // نه یک‌بار روی عنصر نامرئی.
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
    // قبل از نمایش علامت می‌خورد: خوش‌آمد نباید در صفحه بعدی بازدیدکننده
    // دوباره بیاید، چه بخواندش چه نخواند.
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
        color="brand"
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
          // حباب به لبه صفحه می‌چسبد: در گوشه‌های پایین بالای دکمه و در
          // بالایی‌ها پایین آن. هر دو آرایش از یک ترتیب DOM می‌آیند —
          // column-reverse سرِ فرزند اول را عوض می‌کند.
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
                    // حباب چت را باز می‌کند؛ دکمه بستن فقط می‌بندد.
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
        // بسته هم مونت می‌ماند تا بج نخوانده به‌روز بماند: poll ارزان مالِ
        // خود پنل چت است و مونت دوباره در هر باز شدن آن را از صفر راه
        // می‌انداخت.
        keepMounted
        // رشته ساده، مثل AuthModal: کشو عنوانش را در <h2> می‌پیچد و <Title>
        // اینجا heading داخل heading می‌ساخت و React هشدار مارک‌آپ نامعتبر
        // می‌داد. وزن عنوان با styles حفظ شده.
        title="پشتیبانی آنلاین"
        styles={{ title: { fontWeight: 600 } }}
        closeButtonProps={{ 'aria-label': 'بستن', icon: <IconX size={18} /> }}
      >
        <Text size="xs" c="dimmed" mb="sm">
          گفتگوی شما با پشتیبان فروشگاه — پاسخ‌ها همین‌جا نمایش داده می‌شوند.
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
