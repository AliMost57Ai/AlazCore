import type { SupportMessageDTO, SupportTicketDTO } from '@/lib/customer-tickets';
import { act, render, screen, waitFor } from '@/test-utils';
import SupportChat from './SupportChat';

/**
 * رفتار چت پشتیبانی سمت مشتری/مهمان — همه fetchها mock می‌شوند تا این تست‌ها
 * فقط منطق ویوها را ببیند: مسیر مهمان، لیست مشتری با بج نخوانده و قفل تیکت
 * بسته.
 */

const WELCOME = 'سلام! در خدمتیم.';

/** یک تیکت ساده به‌شکل DTO سرور. */
function ticket(overrides: Partial<SupportTicketDTO> = {}): SupportTicketDTO {
  return {
    id: 't1',
    displayId: 'TK-70101',
    subject: 'پیگیری سفارش',
    status: 'open',
    requesterName: 'مشتری نمونه',
    requesterPhone: '09120000000',
    isGuest: false,
    userId: 'u1',
    lastMessage: 'سلام، سفارشم نرسیده.',
    lastMessageAuthor: 'customer',
    lastMessageDate: '۱۴۰۵/۰۷/۲۵',
    lastMessageAt: '2026-10-17T09:00:00.000Z',
    unread: false,
    createdAt: '2026-10-17T09:00:00.000Z',
    ...overrides,
  };
}

function message(overrides: Partial<SupportMessageDTO> = {}): SupportMessageDTO {
  return {
    id: 'm1',
    authorSide: 'customer',
    authorName: 'مشتری نمونه',
    body: 'سلام، سفارشم نرسیده.',
    imagePath: null,
    date: '۱۴۰۵/۰۷/۲۵ ۰۹:۰۰',
    createdAt: '2026-10-17T09:00:00.000Z',
    ...overrides,
  };
}

/** fetch را mock می‌کند و نتیجه آخرین فراخوانی را برمی‌گرداند — طولانی‌ترین
 *  مسیر اول می‌گیرد تا /api/support/tickets/t1 را لیست بلع نکند. */
function mockFetch(routes: Record<string, unknown>) {
  const entries = Object.entries(routes).sort((a, b) => b[0].length - a[0].length);
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = entries.find(([path]) => url.includes(path));
    if (!hit) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return {
      ok: true,
      json: async () => hit[1],
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('SupportChat — مسیر مهمان', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('بدون تیکت، فرم شناسایی مهمان را نشان می‌دهد و دکمه تا معتبر شدن فعال نمی‌شود', async () => {
    mockFetch({ '/api/support/tickets': { tickets: [] } });
    render(<SupportChat customerName={null} welcome={WELCOME} />);

    await waitFor(() => expect(screen.getByText('ارسال پیام')).toBeInTheDocument());
    expect(screen.getByText('نام و نام خانوادگی')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال پیام' })).toBeDisabled();
  });

  it('وقتی مهمان تیکت قبلی دارد، به‌جای intro لیست گفتگوها را می‌بیند', async () => {
    mockFetch({
      '/api/support/tickets': { tickets: [ticket({ isGuest: true, userId: null })] },
    });
    render(<SupportChat customerName={null} welcome={WELCOME} />);

    await waitFor(() => expect(screen.getByText('پیگیری سفارش')).toBeInTheDocument());
    expect(screen.queryByText('نام و نام خانوادگی')).not.toBeInTheDocument();
  });
});

describe('SupportChat — مسیر مشتری', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('تیکت نخوانده را در لیست با بج نشان می‌دهد', async () => {
    mockFetch({
      '/api/support/tickets': { tickets: [ticket({ unread: true })] },
    });
    render(<SupportChat customerName="مشتری نمونه" welcome={WELCOME} />);

    await waitFor(() => expect(screen.getByText('پیگیری سفارش')).toBeInTheDocument());
    expect(screen.getByText('در انتظار پاسخ')).toBeInTheDocument();
  });

  it('تیکت بسته را با اعلان باز می‌کند و کامپوزر ندارد', async () => {
    const fetchMock = mockFetch({
      '/api/support/tickets': { tickets: [ticket({ status: 'closed' })] },
      '/api/support/tickets/t1': {
        ticket: {
          ...ticket({ status: 'closed' }),
          messages: [message()],
        },
      },
    });

    render(<SupportChat customerName="مشتری نمونه" welcome={WELCOME} />);

    // باز کردن تیکت از لیست.
    await waitFor(() => expect(screen.getByText('پیگیری سفارش')).toBeInTheDocument());
    act(() => {
      screen.getByText('پیگیری سفارش').click();
    });

    await waitFor(() =>
      expect(
        screen.getByText('این تیکت بسته شده است — برای ادامه، تیکت تازه‌ای بسازید.')
      ).toBeInTheDocument()
    );
    expect(screen.queryByPlaceholderText('پاسخ خود را بنویسید…')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/support/tickets/t1');
  });

  it('باز کردن تیکت نخوانده، شمار نخواندهٔ گزارش‌شده را صفر می‌کند', async () => {
    mockFetch({
      '/api/support/tickets': { tickets: [ticket({ unread: true })] },
      '/api/support/tickets/t1': {
        ticket: {
          ...ticket(),
          messages: [message()],
        },
      },
    });

    // onUnreadChange همان خروجی ویجت (بج شناور) است — اثبات پاک‌شدن بج.
    const onUnreadChange = jest.fn();
    render(
      <SupportChat customerName="مشتری نمونه" welcome={WELCOME} onUnreadChange={onUnreadChange} />
    );

    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(1));
    act(() => {
      screen.getByText('پیگیری سفارش').click();
    });

    await waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0));
  });
});
