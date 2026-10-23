import { render, screen, userEvent, waitFor } from '@/test-utils';
import ChangePasswordModal from './ChangePasswordModal';

// The toast is not what this component decides — the request and whether the
// dialog closes are. Mocked so the assertions stay on those.
jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }));

const { notifications } = jest.requireMock<{ notifications: { show: jest.Mock } }>(
  '@mantine/notifications'
);

/**
 * Types into the labelled fields one after another.
 *
 * Sequential on purpose: `userEvent` drives a single shared instance, so typing
 * into three inputs at once makes the focus race and silently drops characters.
 */
async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: Record<string, string>
): Promise<void> {
  for (const [label, value] of Object.entries(values)) {
    await user.type(screen.getByLabelText(label), value);
  }
}

describe('ChangePasswordModal', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    notifications.show.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the two passwords and closes on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();
    render(<ChangePasswordModal opened onClose={onClose} />);

    await fill(user, {
      'گذرواژه فعلی': 'old-secret',
      'گذرواژه جدید': 'new-secret-1',
      'تکرار گذرواژه جدید': 'new-secret-1',
    });
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/account/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'old-secret', newPassword: 'new-secret-1' }),
      })
    );
  });

  it('shows the server message and stays open when the current password is wrong', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'گذرواژه فعلی نادرست است.' }),
    });
    const user = userEvent.setup();
    render(<ChangePasswordModal opened onClose={onClose} />);

    await fill(user, {
      'گذرواژه فعلی': 'wrong',
      'گذرواژه جدید': 'new-secret-1',
      'تکرار گذرواژه جدید': 'new-secret-1',
    });
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));

    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'گذرواژه فعلی نادرست است.' })
      )
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never sends a request when the confirmation does not match', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordModal opened onClose={onClose} />);

    await fill(user, {
      'گذرواژه فعلی': 'old-secret',
      'گذرواژه جدید': 'new-secret-1',
      'تکرار گذرواژه جدید': 'new-secret-2',
    });
    await user.click(screen.getByRole('button', { name: 'ذخیره' }));

    expect(
      await screen.findByText('تکرار گذرواژه با گذرواژه جدید یکسان نیست.')
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
