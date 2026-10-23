import { render, screen } from '@/test-utils';
import StaffWelcome from './StaffWelcome';

// The labels come from lib/nav-permissions.ts MENU_LABELS — the same words the
// /roles page and the system log use, which is the point of looking them up
// rather than repeating them here.
describe('StaffWelcome', () => {
  it('links to the pages the grants actually open', () => {
    render(<StaffWelcome firstName="آرش" perms={['/orders', '/support']} />);

    expect(screen.getByText('سلام آرش 👋')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'سفارش‌ها' })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('link', { name: 'تیکت‌های پشتیبانی' })).toHaveAttribute(
      'href',
      '/support'
    );
  });

  it('never links a grant that is a permission token rather than a page', () => {
    render(<StaffWelcome firstName="آرش" perms={['/customers/file']} />);

    // '/customers/file' is a capability with nothing served at it; a link would
    // 404. With it filtered out there is nothing left, so the empty state shows.
    expect(screen.queryByRole('link', { name: 'مشاهدهٔ پروندهٔ مشتری' })).not.toBeInTheDocument();
    expect(screen.getByText('هنوز دسترسی‌ای برای شما ثبت نشده است')).toBeInTheDocument();
  });

  it('explains itself when the account holds no grants at all', () => {
    render(<StaffWelcome firstName="آرش" perms={[]} />);

    expect(screen.getByText('هنوز دسترسی‌ای برای شما ثبت نشده است')).toBeInTheDocument();
    // The own-settings page is open to everyone, so it is offered regardless.
    expect(screen.getByRole('link', { name: 'حساب کاربری و تنظیمات نمایش' })).toHaveAttribute(
      'href',
      '/settings'
    );
  });
});
