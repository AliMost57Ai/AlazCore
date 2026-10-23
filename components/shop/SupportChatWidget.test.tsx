import { DEFAULT_SUPPORT_WIDGET_CONFIG, type SupportWidgetConfig } from '@/lib/support-widget';
import { act, render, screen } from '@/test-utils';
import SupportChatWidget from './SupportChatWidget';

/**
 * پنل چت داخل کشو روی mount چند fetch/poll می‌زند که ربطی به این فایل ندارند —
 * stub می‌شوند تا این تست‌ها فقط رفتار خود ویجت را ببیند: کجا می‌نشیند، چطور
 * می‌آید و خوش‌آمدش چطور رفتار می‌کند.
 */
jest.mock('@/components/support/SupportChat', () => ({
  __esModule: true,
  default: () => <div data-testid="support-chat" />,
}));

const WELCOME = 'سلام! در خدمتیم.';

/** ویجت به همان شکلی که فروشگاه مونت می‌کند، با تغییر فقط فیلدهای زیر تست. */
function config(overrides: Partial<SupportWidgetConfig> = {}): SupportWidgetConfig {
  return { ...DEFAULT_SUPPORT_WIDGET_CONFIG, ...overrides };
}

function setup(overrides: Partial<SupportWidgetConfig> = {}) {
  return render(
    <SupportChatWidget customerName={null} welcome={WELCOME} config={config(overrides)} />
  );
}

/** دکمه شناور، یا null وقتی تأخیر تنظیم‌شده هنوز جلوی مونتش را گرفته. */
function button() {
  return screen.queryByLabelText('گفتگو با پشتیبانی');
}

/** ظرف fixed که دکمه و حباب خوش‌آمد هر دو داخلش هستند. */
function container(): HTMLElement {
  const node = button()?.closest('div[style*="position: fixed"]');
  if (!node) {
    throw new Error('the widget container is not mounted');
  }
  return node as HTMLElement;
}

/**
 * پنل چت داخل کشو — keepMounted است، پس همیشه در DOM است و حالت بسته
 * display:none روی محتواست، نه حذف subtree.
 */
function drawer(): HTMLElement {
  const node = screen.getByTestId('support-chat').closest('.mantine-Drawer-content');
  if (!node) {
    throw new Error('the drawer content was not found');
  }
  return node as HTMLElement;
}

/** اجازه دادن به تایمرها و افکت‌های ناشی ازشان که جمع شوند. */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('SupportChatWidget', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('دکمه را در گوشه تنظیم‌شده لنگر می‌کند', () => {
    setup({ position: 'top-right', animation: 'none' });
    expect(container()).toHaveStyle({ right: '20px', top: '20px' });
  });

  it('پیش‌فرض همان پایین-چپ می‌ماند', () => {
    setup({ animation: 'none' });
    expect(container()).toHaveStyle({ left: '20px', bottom: '20px' });
  });

  it('برای تأخیر تنظیم‌شده دکمه را نگه می‌دارد', () => {
    setup({ delayMs: 3_000, animation: 'none' });
    expect(button()).toBeNull();

    advance(2_999);
    expect(button()).toBeNull();

    advance(1);
    expect(button()).not.toBeNull();
  });

  it('با تأخیر صفر، دکمه بی‌درنگ هست', () => {
    setup({ delayMs: 0, animation: 'none' });
    expect(button()).not.toBeNull();
  });

  it('برای هر انیمیشنی — از جمله none — دکمه سالم مونت می‌شود', () => {
    for (const animation of ['none', 'fade', 'scale', 'slide', 'pop'] as const) {
      const { unmount } = setup({ animation, position: 'bottom-left' });
      expect(button()).not.toBeNull();
      unmount();
    }
  });

  it('یک‌بار خوش‌آمد می‌گوید و حباب خودش بسته می‌شود', () => {
    setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.getByText(WELCOME)).toBeInTheDocument();

    advance(4_000);
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('در همان نشست دوباره خوش‌آمد نمی‌گوید', () => {
    const first = setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    first.unmount();

    // یک نمای صفحه بعدی — همان نشست مرورگر.
    setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('با خاموشی بستنِ خودکار، حباب باز می‌ماند', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });
    advance(60_000);
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
  });

  it('وقتی حباب خاموش است هرگز خوش‌آمد نمی‌گوید', () => {
    setup({ noticeEnabled: false, animation: 'none' });
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('کلیک روی حباب چت را باز می‌کند', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });

    act(() => {
      screen.getByText(WELCOME).click();
    });

    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(drawer()).toBeVisible();
  });

  it('کشو تا فشرده‌شدن دکمه بسته می‌ماند', () => {
    setup({ animation: 'none' });
    expect(drawer()).not.toBeVisible();

    act(() => {
      (button() as HTMLElement).click();
    });

    expect(drawer()).toBeVisible();
  });

  it('دکمه بستن حباب، فقط حباب را می‌بندد', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });

    act(() => {
      screen.getByLabelText('بستن پیام').click();
    });

    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(button()).not.toBeNull();
  });
});
