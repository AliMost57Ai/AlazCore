/**
 * Roles (نقش) — the admin-managed access model behind the /roles page.
 *
 * A user's `role` column stores a Role's machine name. The session-level
 * UserRole is derived from it (resolveUserRole): 'admin' and any role flagged
 * isAdmin sign in with full admin access, 'customer' stays a customer, and
 * everything else is staff whose panel reach is the role's `permissions`
 * list — menu hrefs from lib/nav-permissions.ts (e.g. a کارمند حسابداری
 * role holds /accounting and /payments). The built-ins — admin, member,
 * customer and support (پشتیبان سایت) — are referenced by code, so they can be
 * retitled but never deleted.
 */

import { Prisma } from '@prisma/client';
import prisma from './db';
import { ASSIGNABLE_PERMISSIONS, MENU_LABELS } from './nav-permissions';
import { logSystemAudit } from './system-logs';
import type { UserRole } from './session';

/** Machine names referenced directly by the code — never deletable. */
export const BUILTIN_ROLE_NAMES = ['admin', 'member', 'customer', 'support'] as const;

/** One admin-managed role, with its live user count. */
export interface RoleDTO {
  id: string;
  /** Machine name stored on User.role. */
  name: string;
  /** Persian display title. */
  title: string;
  isAdmin: boolean;
  /** Permission entries this role holds — meaningless when isAdmin. */
  permissions: string[];
  /** Users currently holding this role. */
  userCount: number;
  /** True for admin/member/customer/support — retitling allowed, deletion not. */
  isBuiltIn: boolean;
}

export type RoleMutationResult = { ok: true } | { ok: false; error: string };

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

/**
 * Derives the session-level access of a stored role name: admin-named or
 * admin-flagged roles are 'admin', 'customer' stays 'customer', the rest are
 * staff. The two built-ins resolve without a DB hit.
 */
export async function resolveUserRole(roleName: string): Promise<UserRole> {
  if (roleName === 'admin') {
    return 'admin';
  }
  if (roleName === 'customer') {
    return 'customer';
  }
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    select: { isAdmin: true },
  });
  return role?.isAdmin === true ? 'admin' : 'member';
}

/**
 * The permission entries a stored role name holds: ['*'] for admin-flagged
 * roles (they see everything), the role's permissions list otherwise. Unknown
 * or missing roles resolve to nothing.
 */
export async function getRolePermissions(roleName: string): Promise<string[]> {
  if (roleName === 'admin') {
    return ['*'];
  }
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    select: { isAdmin: true, permissions: true },
  });
  if (!role) {
    return [];
  }
  if (role.isAdmin) {
    return ['*'];
  }
  return parsePermissions(role.permissions);
}

/** Parses a Role.permissions JSON column; anything odd reads as empty. */
function parsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * Keeps only known, de-duplicated permission entries. A redundant
 * `href:view` is canonicalised to the bare href (they mean the same thing).
 */
function normalizePermissions(
  input: unknown
): { ok: true; permissions: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'فهرست دسترسی‌های نقش نامعتبر است.' };
  }
  const canonical = input
    .filter((item): item is string => typeof item === 'string' && item !== '')
    .map((entry) => entry.replace(/:view$/, ''));
  const permissions = [...new Set(canonical)];
  const unknown = permissions.filter((entry) => !ASSIGNABLE_PERMISSIONS.includes(entry));
  if (unknown.length > 0) {
    return { ok: false, error: 'یک یا چند دسترسی انتخابی شناخته نشد.' };
  }
  return { ok: true, permissions };
}

/** All roles with their user counts, newest first. */
export async function listRoles(): Promise<RoleDTO[]> {
  const [roles, counts] = await Promise.all([
    prisma.role.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);
  const countByRole = new Map(counts.map((row) => [row.role, row._count._all]));

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    title: role.title,
    isAdmin: role.isAdmin,
    permissions: role.isAdmin ? [] : parsePermissions(role.permissions),
    userCount: countByRole.get(role.name) ?? 0,
    isBuiltIn: (BUILTIN_ROLE_NAMES as readonly string[]).includes(role.name),
  }));
}

/** A stored permission list as the Persian menu names the admin ticked. */
function describePermissions(hrefs: string[]): string {
  if (hrefs.length === 0) {
    return 'بدون دسترسی';
  }
  return hrefs.map((href) => MENU_LABELS[href] ?? href).join('، ');
}

/**
 * The before/after lines for the audit log — one per field that actually
 * changed. An empty list means the save was a no-op, and the caller writes no
 * log row at all: a log full of "nothing happened" is worse than a short one.
 * `permissionTouched` is separate only so the caller can pick the action verb.
 */
function describeRoleChanges(
  before: { name: string; title: string; isAdmin: boolean; permissions: string[] },
  after: { name: string; title: string; isAdmin: boolean; permissions: string[] }
): { lines: string[]; permissionTouched: boolean } {
  const lines: string[] = [];

  if (before.name !== after.name) {
    lines.push(`نام ماشینی: ${before.name} به ${after.name}`);
  }
  if (before.title !== after.title) {
    lines.push(`عنوان: «${before.title}» به «${after.title}»`);
  }
  if (before.isAdmin !== after.isAdmin) {
    lines.push(`دسترسی مدیر: ${after.isAdmin ? 'فعال شد' : 'برداشته شد'}`);
  }
  const permissionTouched = before.permissions.join(',') !== after.permissions.join(',');
  if (permissionTouched) {
    lines.push(`دسترسی‌های قبلی: ${describePermissions(before.permissions)}`);
    lines.push(`دسترسی‌های جدید: ${describePermissions(after.permissions)}`);
  }

  return { lines, permissionTouched };
}

/** Validates + creates a role. */
export async function createRole(
  input: {
    name: string;
    title: string;
    isAdmin: boolean;
    permissions: unknown;
  },
  /** Display name of the admin making the change — recorded in the system log. */
  actor: string
): Promise<RoleMutationResult & { id?: string }> {
  const name = input.name.trim().toLowerCase();
  const title = input.title.trim();

  if (!NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: 'نام نقش باید با حرف لاتین کوچک شروع شود و ۲ تا ۳۲ نویسه لاتین/عدد باشد.',
    };
  }
  if (title.length < 2 || title.length > 64) {
    return { ok: false, error: 'عنوان نقش باید ۲ تا ۶۴ نویسه باشد.' };
  }
  const perms = normalizePermissions(input.permissions);
  if (!perms.ok) {
    return perms;
  }

  try {
    const role = await prisma.role.create({
      data: {
        name,
        title,
        isAdmin: input.isAdmin,
        permissions: JSON.stringify(perms.permissions),
      },
    });
    await logSystemAudit({
      kind: 'user',
      action: 'create',
      actor,
      message: `نقش «${title}» ساخته شد.`,
      detail: [
        `نام ماشینی: ${name}`,
        `دسترسی مدیر: ${input.isAdmin ? 'دارد' : 'ندارد'}`,
        `دسترسی‌ها: ${describePermissions(perms.permissions)}`,
      ].join('\n'),
    });
    return { ok: true, id: role.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'نقشی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/**
 * Validates + updates a role. Uniqueness is enforced on the machine name; a
 * name change re-tags every user holding the old one in the same transaction,
 * so nobody is orphaned on a random string. Permission changes take effect
 * for each affected user at their next sign-in.
 */
export async function updateRole(
  id: string,
  input: {
    name: string;
    title: string;
    isAdmin: boolean;
    permissions: unknown;
  },
  /** Display name of the admin making the change — recorded in the system log. */
  actor: string
): Promise<RoleMutationResult> {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return { ok: false, error: 'نقش یافت نشد.' };
  }

  const name = input.name.trim().toLowerCase();
  const title = input.title.trim();

  if (!NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: 'نام نقش باید با حرف لاتین کوچک شروع شود و ۲ تا ۳۲ نویسه لاتین/عدد باشد.',
    };
  }
  if (title.length < 2 || title.length > 64) {
    return { ok: false, error: 'عنوان نقش باید ۲ تا ۶۴ نویسه باشد.' };
  }
  const perms = normalizePermissions(input.permissions);
  if (!perms.ok) {
    return perms;
  }
  if (role.isAdmin && !input.isAdmin && role.name === 'admin') {
    return { ok: false, error: 'نقش «admin» باید دسترسی مدیر داشته باشد.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name,
          title,
          isAdmin: input.isAdmin,
          permissions: JSON.stringify(perms.permissions),
        },
      });
      if (name !== role.name) {
        await tx.user.updateMany({ where: { role: role.name }, data: { role: name } });
      }
    });

    // `role` is the pre-update row read at the top of this function, so it is
    // exactly the "before" side of the diff. A save that changed nothing
    // writes no row — see describeRoleChanges.
    const { lines, permissionTouched } = describeRoleChanges(
      {
        name: role.name,
        title: role.title,
        isAdmin: role.isAdmin,
        permissions: parsePermissions(role.permissions),
      },
      { name, title, isAdmin: input.isAdmin, permissions: perms.permissions }
    );
    if (lines.length > 0) {
      const holders = await prisma.user.count({ where: { role: name } });
      await logSystemAudit({
        kind: 'user',
        // A permission change is the one an audit reader looks for by name;
        // a retitle is ordinary housekeeping.
        action: permissionTouched ? 'permissions' : 'update',
        actor,
        message: permissionTouched
          ? `دسترسی‌های نقش «${title}» تغییر کرد.`
          : `نقش «${title}» ویرایش شد.`,
        // Permissions are signed into each session at sign-in, so a change here
        // does not reach anybody until they sign in again — worth saying in the
        // log rather than leaving the admin to wonder why nothing moved.
        detail: [...lines, `کاربران این نقش: ${holders} (اعمال از ورود بعدی)`].join('\n'),
      });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'نقشی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** Deletes a role — never a built-in or one that users still hold. */
export async function deleteRole(
  id: string,
  /** Display name of the admin making the change — recorded in the system log. */
  actor: string
): Promise<RoleMutationResult> {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return { ok: false, error: 'نقش یافت نشد.' };
  }
  if ((BUILTIN_ROLE_NAMES as readonly string[]).includes(role.name)) {
    return {
      ok: false,
      error: 'نقش‌های پیش‌فرض (admin، member، customer، support) حذف نمی‌شوند.',
    };
  }

  const holders = await prisma.user.count({ where: { role: role.name } });
  if (holders > 0) {
    return {
      ok: false,
      error: `این نقش روی ${holders} کاربر تنظیم است — اول کاربرانش را تغییر دهید.`,
    };
  }

  await prisma.role.delete({ where: { id } });
  await logSystemAudit({
    kind: 'user',
    action: 'delete',
    actor,
    message: `نقش «${role.title}» حذف شد.`,
    detail: [
      `نام ماشینی: ${role.name}`,
      `دسترسی‌ها: ${describePermissions(parsePermissions(role.permissions))}`,
    ].join('\n'),
  });
  return { ok: true };
}
