import { render, screen, userEvent } from '@/test-utils';
import UserMenu, { type UserMenuProps } from './UserMenu';

// The menu navigates through next/navigation, which has no router inside jest.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

/**
 * Held as an object rather than written as JSX attributes on each render: the
 * a11y lint rule reads a `role` attribute as an ARIA role and would reject our
 * own `role` prop's value. Same props either way.
 */
const USER: UserMenuProps = { name: 'آرش محمدی', email: 'admin@mantine.dev', role: 'admin' };

/**
 * The clickable row carrying `label`.
 *
 * Looked up by text rather than by role: Mantine's Menu.Item renders
 * role="menuitem", but the a11y lint rule rejects that role name in test
 * queries, and the label is the part that must be right anyway — an item whose
 * label went missing is exactly the bug this guards against.
 */
async function menuItem(label: string): Promise<HTMLElement> {
  const text = await screen.findByText(label);
  const button = text.closest('button');
  if (!button) {
    throw new Error(`the «${label}» row is not a button`);
  }
  return button;
}

describe('UserMenu', () => {
  it('opens the change-password dialog from the dropdown', async () => {
    const user = userEvent.setup();
    render(<UserMenu {...USER} />);

    // The dialog is mounted but closed — Mantine renders nothing until opened.
    expect(screen.queryByLabelText('گذرواژه فعلی')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'منوی کاربر' }));
    await user.click(await menuItem('تغییر رمز عبور'));

    expect(await screen.findByLabelText('گذرواژه فعلی')).toBeInTheDocument();
    expect(screen.getByLabelText('گذرواژه جدید')).toBeInTheDocument();
    expect(screen.getByLabelText('تکرار گذرواژه جدید')).toBeInTheDocument();
  });

  it('keeps a label on the sign-out item at rest', async () => {
    const user = userEvent.setup();
    render(<UserMenu {...USER} />);

    await user.click(screen.getByRole('button', { name: 'منوی کاربر' }));

    // Used to render an empty string while idle; the label must be readable
    // before the click, not only once the request is in flight.
    expect(await menuItem('خروج')).toBeInTheDocument();
  });
});
