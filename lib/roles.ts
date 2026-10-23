/**
 * Roles (نقش) — the admin-managed access model behind /users and /roles.
 *
 * A user's `role` column stores a Role's machine name. The session-level
 * UserRole is derived from it (resolveUserRole): 'admin' and any role flagged
 * isAdmin sign in with full admin access, 'customer' stays a customer, and
 * everything else is staff whose panel reach is the role's `permissions`
 * list — entries from lib/nav-permissions.ts, one bare href for view plus
 * `href:edit` / `href:add` for the write actions (e.g. an انبار role holds
 * '/products', '/products:edit', '/products:add'). The three built-ins —
 * admin, member, customer — are referenced by code, so they can be retitled
 * but never deleted.
 */

import { Prisma } from './generated/prisma/client';
import prisma from './db';
import { ASSIGNABLE_PERMISSIONS } from './nav-permissions';
import type { UserRole } from './session';

/** Machine names referenced directly by the code — never deletable. */
export const BUILTIN_ROLE_NAMES = ['admin', 'member', 'customer'] as const;

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
  /** True for admin/member/customer — retitling allowed, deletion not. */
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

/** Validates + creates a role. */
export async function createRole(input: {
  name: string;
  title: string;
  isAdmin: boolean;
  permissions: unknown;
}): Promise<RoleMutationResult & { id?: string }> {
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
  }
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
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'نقشی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** Deletes a role — never a built-in or one that users still hold. */
export async function deleteRole(id: string): Promise<RoleMutationResult> {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return { ok: false, error: 'نقش یافت نشد.' };
  }
  if ((BUILTIN_ROLE_NAMES as readonly string[]).includes(role.name)) {
    return { ok: false, error: 'نقش‌های پیش‌فرض (admin، member، customer) حذف نمی‌شوند.' };
  }

  const holders = await prisma.user.count({ where: { role: role.name } });
  if (holders > 0) {
    return {
      ok: false,
      error: `این نقش روی ${holders} کاربر تنظیم است — اول کاربرانش را تغییر دهید.`,
    };
  }

  await prisma.role.delete({ where: { id } });
  return { ok: true };
}

// ── گروه نقش‌ها (RoleGroup) ────────────────────────────────────────────────
// دسته‌بندی صرفاً نمایشی نقش‌ها در /role-groups — هیچ دسترسی‌ای نمی‌دهد و
// حذفش فقط نقش‌ها را بی‌گروه می‌کند (SetNull در اسکیما).

/** One display-only role group, with its live role count. */
export interface RoleGroupDTO {
  id: string;
  name: string;
  description: string;
  /** Roles currently filed under this group. */
  roleCount: number;
}

/** All role groups in display order, with role counts. */
export async function listRoleGroups(): Promise<RoleGroupDTO[]> {
  const groups = await prisma.roleGroup.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { roles: true } } },
  });
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    roleCount: group._count.roles,
  }));
}

function validateGroupInput(input: { name: string; description: string }): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 64) {
    return 'نام گروه باید ۲ تا ۶۴ نویسه باشد.';
  }
  if (input.description.trim().length > 200) {
    return 'توضیح گروه نمی‌تواند بیشتر از ۲۰۰ نویسه باشد.';
  }
  return null;
}

/** Validates + creates a role group. */
export async function createRoleGroup(input: {
  name: string;
  description: string;
}): Promise<RoleMutationResult & { id?: string }> {
  const invalid = validateGroupInput(input);
  if (invalid) {
    return { ok: false, error: invalid };
  }

  try {
    const group = await prisma.roleGroup.create({
      data: { name: input.name.trim(), description: input.description.trim() },
    });
    return { ok: true, id: group.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'گروهی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** Validates + updates a role group. */
export async function updateRoleGroup(
  id: string,
  input: { name: string; description: string }
): Promise<RoleMutationResult> {
  const group = await prisma.roleGroup.findUnique({ where: { id } });
  if (!group) {
    return { ok: false, error: 'گروه یافت نشد.' };
  }

  const invalid = validateGroupInput(input);
  if (invalid) {
    return { ok: false, error: invalid };
  }

  try {
    await prisma.roleGroup.update({
      where: { id },
      data: { name: input.name.trim(), description: input.description.trim() },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'گروهی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** Deletes a role group — its roles survive, just ungrouped (SetNull). */
export async function deleteRoleGroup(id: string): Promise<RoleMutationResult> {
  const group = await prisma.roleGroup.findUnique({ where: { id } });
  if (!group) {
    return { ok: false, error: 'گروه یافت نشد.' };
  }

  await prisma.roleGroup.delete({ where: { id } });
  return { ok: true };
}
