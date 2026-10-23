import { DEFAULT_SETTINGS } from '@/lib/settings';
import { render, screen, userEvent, waitFor } from '@/test-utils';
import SupportSettings from './SupportSettings';

/**
 * رگرسیون بازخورد کاربر: فیلدهای ثانیه باید قابل مقداردهی باشند، خالی‌شان به
 * پیش‌فرض نرمال شود و خاموشی پشتیبانی نباید به‌خاطر آن‌ها خطا بدهد.
 * همه PUTها با fetch mock گرفته می‌شوند و بدنهٔ آخرین درخواست بررسی می‌شود.
 */

const initial = { ...DEFAULT_SETTINGS };

function lastPutBody(): Record<string, unknown> {
  const calls = (global.fetch as jest.Mock).mock.calls;
  const last = calls[calls.length - 1] as [string, RequestInit];
  expect(last?.[0]).toBe('/api/admin/settings');
  return JSON.parse(String(last[1].body));
}

/** ورودی داخل InputWrapper برچسب‌دار — برچسب منتین برای getByLabelText
 *  association مطمئنی نمی‌سازد، پس از root پرس می‌کنیم. */
function inputByLabel(label: string): HTMLInputElement {
  const root = screen.getByText(label).closest('.mantine-InputWrapper-root');
  const input = root?.querySelector('input');
  if (!input) {
    throw new Error(`input not found for label: ${label}`);
  }
  return input as HTMLInputElement;
}

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  jest.resetAllMocks();
});

/** سوییچ/ورودی هم‌ریشه با برچسب — از متن برچسب بالا می‌رود تا اولین جدّی که
 *  ورودی را در خود دارد (ساختار Switch با InputWrapper فرق دارد). */
function checkboxByLabel(label: string): HTMLInputElement {
  let node: HTMLElement | null = screen.getByText(label);
  let input: HTMLInputElement | null | undefined = null;
  while (node && !input) {
    input = node.querySelector<HTMLInputElement>('input[type="checkbox"]');
    node = node.parentElement;
  }
  if (!input) {
    throw new Error(`checkbox not found for label: ${label}`);
  }
  return input;
}

describe('SupportSettings', () => {
  it('ثانیهٔ تایپ‌شده به‌صورت رشتهٔ عددی به PUT می‌رسد', async () => {
    const user = userEvent.setup();
    render(<SupportSettings initial={initial} />);

    const delay = inputByLabel('تأخیر نمایش آیکون (ثانیه)');
    await user.clear(delay);
    await user.type(delay, '30');

    await user.click(screen.getByRole('button', { name: 'ذخیره تنظیمات پشتیبانی' }));

    await waitFor(() => {
      expect(lastPutBody().supportWidgetDelay).toBe('30');
    });
  });

  it('ثانیهٔ خالی به‌جای خطا، به پیش‌فرض مرجع نرمال می‌شود', async () => {
    const user = userEvent.setup();
    render(<SupportSettings initial={{ ...initial, supportWidgetDelay: '8' }} />);

    await user.clear(inputByLabel('تأخیر نمایش آیکون (ثانیه)'));
    await user.clear(inputByLabel('مدت نمایش پیام خوش‌آمد (ثانیه)'));

    await user.click(screen.getByRole('button', { name: 'ذخیره تنظیمات پشتیبانی' }));

    await waitFor(() => {
      const body = lastPutBody();
      expect(body.supportWidgetDelay).toBe('0');
      expect(body.supportWidgetNoticeSeconds).toBe('8');
    });
  });

  it('خاموش‌کردن پشتیبانی بدون دست‌زدن به ثانیه‌ها ذخیره می‌شود', async () => {
    const user = userEvent.setup();
    render(<SupportSettings initial={initial} />);

    await user.click(checkboxByLabel('فعال بودن پشتیبانی آنلاین'));
    await user.click(screen.getByRole('button', { name: 'ذخیره تنظیمات پشتیبانی' }));

    await waitFor(() => {
      const body = lastPutBody();
      expect(body.supportEnabled).toBe(false);
      // مقدار پیش‌فرض دست‌نخورده — بدون خطا ارسال شده.
      expect(body.supportWidgetDelay).toBe('0');
    });
  });
});
