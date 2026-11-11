import { render, screen } from '@/test-utils';
import type { RoleDTO } from '@/lib/roles';
import RolesTable from './RolesTable';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

function role(overrides: Partial<RoleDTO> = {}): RoleDTO {
  return {
    id: 'r1',
    name: 'support',
    title: 'پشتیبان سایت',
    isAdmin: false,
    permissions: ['/support'],
    userCount: 0,
    isBuiltIn: true,
    ...overrides,
  };
}

/** The ویرایش button of the row holding `machineName`. */
function editButton(container: HTMLElement, machineName: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
    tr.textContent?.includes(machineName)
  );
  if (!row) {
    throw new Error(`no row for ${machineName}`);
  }
  const button = Array.from(row.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === 'ویرایش'
  );
  if (!button) {
    throw new Error(`no edit button in the ${machineName} row`);
  }
  return button;
}

/** Why the trash icon of that row is disabled, straight from its aria-label. */
function deleteButton(container: HTMLElement, machineName: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
    tr.textContent?.includes(machineName)
  );
  if (!row) {
    throw new Error(`no row for ${machineName}`);
  }
  const button = row.querySelector<HTMLButtonElement>('button[aria-label^="حذف "]');
  if (!button) {
    throw new Error(`no delete button in the ${machineName} row`);
  }
  return button;
}

/**
 * The /roles table is the one page an admin uses to hand out panel access, so
 * these cover the two things that make it feel broken: the edit modal opening
 * with the role's own values, and the delete button explaining itself instead
 * of going quietly dead.
 */
describe('RolesTable', () => {
  it('fills the edit form from the role that was clicked', async () => {
    const { container } = render(
      <RolesTable
        capabilities={[]}
        roles={[
          role({
            id: 'r2',
            name: 'finance_officer',
            title: 'کارمند مالی',
            isBuiltIn: false,
            permissions: ['/coupons', '/price-updates'],
          }),
        ]}
      />
    );

    editButton(container, 'finance_officer').click();

    // `findBy*` rather than `getBy*`: the modal's body mounts only once its
    // Mantine transition has run, which takes a tick.
    expect(await screen.findByDisplayValue('finance_officer')).toBeTruthy();
    expect(screen.getByDisplayValue('کارمند مالی')).toBeTruthy();
    // The granted menus arrive ticked, so saving without touching anything is
    // a no-op rather than a silent permission wipe. Each menu row is a
    // view/edit/add checkbox trio, addressed through its per-action aria-label.
    expect((screen.getByLabelText('کد تخفیف — view') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('حسابداری — view') as HTMLInputElement).checked).toBe(false);
  });

  it('disables deleting a built-in role', () => {
    const { container } = render(<RolesTable roles={[role()]} capabilities={[]} />);
    expect(deleteButton(container, 'support').disabled).toBe(true);
  });

  it('disables deleting a role that still has users', () => {
    const { container } = render(
      <RolesTable
        capabilities={[]}
        roles={[role({ name: 'finance_officer', title: 'کارمند مالی', isBuiltIn: false, userCount: 2 })]}
      />
    );
    expect(deleteButton(container, 'finance_officer').disabled).toBe(true);
  });

  it('allows deleting a custom role nobody holds', () => {
    const { container } = render(
      <RolesTable
        capabilities={[]}
        roles={[role({ name: 'finance_officer', title: 'کارمند مالی', isBuiltIn: false, userCount: 0 })]}
      />
    );
    expect(deleteButton(container, 'finance_officer').disabled).toBe(false);
  });
});
