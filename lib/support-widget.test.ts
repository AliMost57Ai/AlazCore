/**
 * تست resolver تنظیمات ویجت چت — پورت تست‌های نسخه مرجع.
 */

import {
  DEFAULT_SUPPORT_WIDGET_CONFIG,
  isWidgetAnimation,
  isWidgetPosition,
  resolveSupportWidgetConfig,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
} from './support-widget';

describe('resolveSupportWidgetConfig', () => {
  it('مقادیر معتبر را همان‌طور نگه می‌دارد', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'top-right',
      supportWidgetAnimation: 'pop',
      supportWidgetDelay: '5',
      supportWidgetNoticeEnabled: true,
      supportWidgetNoticeSeconds: '10',
    });
    expect(config).toEqual({
      position: 'top-right',
      animation: 'pop',
      delayMs: 5_000,
      noticeEnabled: true,
      noticeMs: 10_000,
    });
  });

  it('مقدار ناشناخته به پیش‌فرض می‌خواند، هرگز نمی‌شکند', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'corner-weird',
      supportWidgetAnimation: 'explode',
      supportWidgetDelay: '',
      supportWidgetNoticeEnabled: false,
      supportWidgetNoticeSeconds: 'nope',
    });
    expect(config.position).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.position);
    expect(config.animation).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.animation);
    expect(config.delayMs).toBe(0);
    expect(config.noticeMs).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs);
    expect(config.noticeEnabled).toBe(false);
  });

  it('خارج از بازه مثل «تنظیم‌نشده» رفتار می‌کند نه اینکه اطاعت شود', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'bottom-left',
      supportWidgetAnimation: 'fade',
      supportWidgetDelay: '-4',
      supportWidgetNoticeEnabled: true,
      supportWidgetNoticeSeconds: '1000000',
    });
    expect(config.delayMs).toBe(0);
    expect(config.noticeMs).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs);
  });

  it('ارقام فارسی را می‌پذیرد', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'bottom-left',
      supportWidgetAnimation: 'fade',
      supportWidgetDelay: '۳',
      supportWidgetNoticeEnabled: true,
      supportWidgetNoticeSeconds: '۷',
    });
    expect(config.delayMs).toBe(3_000);
    expect(config.noticeMs).toBe(7_000);
  });

  it('۰ ثانیه معنی خودش را دارد: بی‌درنگ و باز ماندن تا بستن دستی', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'bottom-left',
      supportWidgetAnimation: 'none',
      supportWidgetDelay: '0',
      supportWidgetNoticeEnabled: true,
      supportWidgetNoticeSeconds: '0',
    });
    expect(config.delayMs).toBe(0);
    expect(config.noticeMs).toBe(0);
  });
});

describe('whitelistهای API ادمین', () => {
  it('فقط چهار گوشه و پنج انیمیشن می‌شناسد', () => {
    expect(WIDGET_POSITIONS).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
    expect(WIDGET_ANIMATIONS).toEqual(['none', 'fade', 'scale', 'slide', 'pop']);
    expect(isWidgetPosition('bottom-right')).toBe(true);
    expect(isWidgetPosition('middle')).toBe(false);
    expect(isWidgetAnimation('fade')).toBe(true);
    expect(isWidgetAnimation('bounce')).toBe(false);
  });
});
