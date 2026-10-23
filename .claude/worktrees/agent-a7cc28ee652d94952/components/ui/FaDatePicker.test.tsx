import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils';
import FaDatePicker from './FaDatePicker';

/**
 * Regression test for the "Invalid Jalaali year" crash: @mantine/dates
 * round-trips dates through dayjs STRINGS (format('YYYY-MM-DD') on one side,
 * plain dayjs(str) on the other). With the global Jalali calendar the format
 * side writes Jalali but the parser read Gregorian, so each hop shifted the
 * date ~621 years until jalaali-js threw the moment the dropdown opened.
 * The jalaliStringRoundTrip plugin in FaDatePicker patches the parse side —
 * this test fails if that regression ever comes back.
 */
describe('FaDatePicker', () => {
  it('opens the calendar and picks a day without error', async () => {
    const user = userEvent.setup();
    let changed = '';
    const errors: string[] = [];
    window.addEventListener('error', (event) => errors.push(event.message));

    render(<FaDatePicker value="" onChange={(iso) => (changed = iso)} label="تاریخ" />);
    const input = screen.getByRole('button', { name: /تاریخ/ });
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
    expect(changed).not.toBe('');
    // The day cell shows the Jalali day-of-month (a plain number).
    expect(today.textContent).toMatch(/^\d+$/);
  });
});
