import { DEFAULT_SUPPORT_WIDGET_CONFIG, type SupportWidgetConfig } from '@/lib/support-status';
import { act, render, screen } from '@/test-utils';
import SupportChatWidget from './SupportChatWidget';

/**
 * The chat panel inside the drawer polls and fetches on mount — none of which
 * this file is about. It is stubbed so these tests stay on the widget's own
 * behaviour: where the button sits, how it arrives and how the greeting behaves.
 */
jest.mock('@/components/support/SupportChat', () => ({
  __esModule: true,
  default: () => <div data-testid="support-chat" />,
}));

const WELCOME = 'سلام! در خدمتیم.';

/** The widget as the storefront mounts it, with only the fields under test changed. */
function config(overrides: Partial<SupportWidgetConfig> = {}): SupportWidgetConfig {
  return { ...DEFAULT_SUPPORT_WIDGET_CONFIG, ...overrides };
}

function setup(overrides: Partial<SupportWidgetConfig> = {}) {
  return render(
    <SupportChatWidget customerName={null} welcome={WELCOME} config={config(overrides)} />
  );
}

/** The button, or null while the configured delay still holds it back. */
function button() {
  return screen.queryByLabelText('گفتگو با پشتیبانی');
}

/** The fixed container the button and the greeting both live in. */
function container(): HTMLElement {
  const node = button()?.closest('div[style*="position: fixed"]');
  if (!node) {
    throw new Error('the widget container is not mounted');
  }
  return node as HTMLElement;
}

/**
 * The chat drawer's panel — `keepMounted`, so it is always in the DOM and the
 * closed state is a `display: none` on the content, not an unmounted subtree.
 */
function drawer(): HTMLElement {
  const node = screen.getByTestId('support-chat').closest('.mantine-Drawer-content');
  if (!node) {
    throw new Error('the drawer content was not found');
  }
  return node as HTMLElement;
}

/** Let the timers and the effects they trigger settle. */
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

  it('anchors the button in the configured corner', () => {
    setup({ position: 'top-right', animation: 'none' });
    expect(container()).toHaveStyle({ right: '20px', top: '20px' });
  });

  it('keeps the current bottom-left place as the default', () => {
    setup({ animation: 'none' });
    expect(container()).toHaveStyle({ left: '20px', bottom: '20px' });
  });

  it('holds the button back for the configured delay', () => {
    setup({ delayMs: 3_000, animation: 'none' });
    expect(button()).toBeNull();

    advance(2_999);
    expect(button()).toBeNull();

    advance(1);
    expect(button()).not.toBeNull();
  });

  it('shows the button immediately when there is no delay', () => {
    setup({ delayMs: 0, animation: 'none' });
    expect(button()).not.toBeNull();
  });

  it('mounts a working button for every animation, including none', () => {
    for (const animation of ['none', 'fade', 'scale', 'slide', 'pop'] as const) {
      const { unmount } = setup({ animation, position: 'bottom-left' });
      expect(button()).not.toBeNull();
      unmount();
    }
  });

  it('greets once, then closes the bubble by itself', () => {
    setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.getByText(WELCOME)).toBeInTheDocument();

    advance(4_000);
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('does not greet twice in the same session', () => {
    const first = setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    first.unmount();

    // A second page view — same browser session.
    setup({ noticeEnabled: true, noticeMs: 4_000, animation: 'none' });
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('leaves the bubble open when the auto-close is switched off', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });
    advance(60_000);
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
  });

  it('never greets when the notice is switched off', () => {
    setup({ noticeEnabled: false, animation: 'none' });
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it('opens the chat from the greeting, and closes the bubble with it', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });

    act(() => {
      screen.getByText(WELCOME).click();
    });

    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(drawer()).toBeVisible();
  });

  it('leaves the drawer shut until the button is pressed', () => {
    setup({ animation: 'none' });
    expect(drawer()).not.toBeVisible();

    act(() => {
      (button() as HTMLElement).click();
    });

    expect(drawer()).toBeVisible();
  });

  it('closes only the bubble when its close button is pressed', () => {
    setup({ noticeEnabled: true, noticeMs: 0, animation: 'none' });

    act(() => {
      screen.getByLabelText('بستن پیام').click();
    });

    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(button()).not.toBeNull();
  });
});
