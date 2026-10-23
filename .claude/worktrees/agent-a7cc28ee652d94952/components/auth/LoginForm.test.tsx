import { render, screen, userEvent, waitFor } from '@/test-utils';
import LoginForm from './LoginForm';

const DEMO_EMAIL = 'admin@mantine.dev';
const DEMO_PASSWORD = 'admin1234';

// LoginForm navigates via next/navigation, which is not running inside jest.
// jest.mock is hoisted above the consts, so the factory may only reference
// jest.fn() — the actual router object is wired up in beforeEach.
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: () => new URLSearchParams(),
}));

const { useRouter } = jest.requireMock<{ useRouter: jest.Mock }>('next/navigation');
const router = { replace: jest.fn(), refresh: jest.fn() };

describe('LoginForm', () => {
  beforeEach(() => {
    useRouter.mockReturnValue(router);
    router.replace.mockClear();
    router.refresh.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows validation errors when fields are empty', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'ورود به حساب' }));

    expect(await screen.findByText('ایمیل یا شماره موبایل (۰۹…) معتبر نیست.')).toBeInTheDocument();
    expect(await screen.findByText('گذرواژه باید حداقل ۸ نویسه باشد.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits credentials and redirects to the dashboard', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/ایمیل/), DEMO_EMAIL);
    await user.type(screen.getByLabelText(/گذرواژه/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'ورود به حساب' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/dashboard');
      expect(router.refresh).toHaveBeenCalled();
    });
  });

  it('shows the server error message on bad credentials', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'ایمیل یا گذرواژه نادرست است.' }),
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/ایمیل/), DEMO_EMAIL);
    await user.type(screen.getByLabelText(/گذرواژه/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'ورود به حساب' }));

    expect(await screen.findByText('ایمیل یا گذرواژه نادرست است.')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
