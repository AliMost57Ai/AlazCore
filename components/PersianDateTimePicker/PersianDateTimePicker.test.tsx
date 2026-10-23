import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils';
import { PersianDateTimePicker } from './PersianDateTimePicker';

// jsdom matchMedia ندارد — dropdownType='auto' برای تصمیم popover/modal به آن
// نیاز دارد؛ در محیط تست همیشه «دسکتاپ» فرض می‌شود (popover).
beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

/**
 * قرارداد پیکر تاریخ پروژه: تقویم شمسی باز می‌شود (دسکتاپ popover)، انتخاب
 * روز بدون خطا رخ می‌دهد و onChange رشته valueFormat (این‌جا YYYY-MM-DD
 * میلادی معادل همان روز) را می‌دهد — منبع مقدار فیلترهای GET و فرم‌ها.
 */
describe('PersianDateTimePicker', () => {
  it('opens the calendar, picks today and emits the formatted date', async () => {
    const user = userEvent.setup();
    let changed: string | null = null;
    const errors: string[] = [];
    window.addEventListener('error', (event) => errors.push(event.message));

    render(
      <PersianDateTimePicker
        label="تاریخ"
        valueFormat="YYYY-MM-DD"
        showTime={false}
        onChange={(date) => (changed = typeof date === 'string' ? date : null)}
      />
    );

    const input = screen.getByLabelText('تاریخ');
    await user.click(input);

    const today = await waitFor(() => {
      const cell = document.querySelector<HTMLElement>('[data-today]');
      if (!cell) {
        throw new Error('calendar did not render a today cell');
      }
      return cell;
    });
    await user.click(today);

    expect(errors).toEqual([]);
    expect(changed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
