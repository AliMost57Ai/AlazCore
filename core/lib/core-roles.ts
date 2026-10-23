/**
 * نقش‌های پنل Core — بازتاب مستقیم lib/roles.ts فروشگاه (هم‌سانی دو ساید):
 * PBKDF2 همان، قواعد همان — نقش سیستمی حذف نمی‌شود، نقشِ در حال استفاده
 * حذف نمی‌شود، permissions فقط از کاتالوگ مجاز.
 */

import { Prisma } from './generated/prisma/client';
import prisma from './db';
import { CORE_PERMISSIONS } from './nav-permissions';

/** نام‌های نقش سیستمی — قابل تغییر عنوان، غیرقابل حذف. */
export const BUILTIN_CORE_ROLE_NAMES = ['superadmin', 'support'] as const;

export interface CoreRoleDTO {
  id: string;
  name: string;
  title: string;
  isAdmin: boolean;
  permissions: string[];
  /** کاربرانِ در حال استفاده از این نقش. */
  userCount: number;
  isBuiltIn: boolean;
}

export type CoreRoleMutationResult = { ok: true } | { ok: false; error: string };

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

function parsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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
  const unknown = permissions.filter((entry) => !CORE_PERMISSIONS.includes(entry));
  if (unknown.length > 0) {
    return { ok: false, error: 'یک یا چند دسترسی انتخابی شناخته نشد.' };
  }
  return { ok: true, permissions };
}

/** همه نقش‌ها با شمار کاربران. */
export async function listCoreRoles(): Promise<CoreRoleDTO[]> {
  const [roles, counts] = await Promise.all([
    prisma.coreRole.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.coreUser.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);
  const countByRole = new Map(counts.map((row) => [row.role, row._count._all]));

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    title: role.title,
    isAdmin: role.isAdmin,
    permissions: role.isAdmin ? [] : parsePermissions(role.permissions),
    userCount: countByRole.get(role.name) ?? 0,
    isBuiltIn: (BUILTIN_CORE_ROLE_NAMES as readonly string[]).includes(role.name),
  }));
}

function validateInput(input: { name: string; title: string }): string | null {
  if (!NAME_PATTERN.test(input.name.trim())) {
    return 'نام نقش باید با حرف لاتین کوچک شروع شود و ۲ تا ۳۲ نویسه لاتین/عدد باشد.';
  }
  const title = input.title.trim();
  if (title.length < 2 || title.length > 64) {
    return 'عنوان نقش باید ۲ تا ۶۴ نویسه باشد.';
  }
  return null;
}

/** ساخت نقش. */
export async function createCoreRole(input: {
  name: string;
  title: string;
  isAdmin: boolean;
  permissions: unknown;
}): Promise<CoreRoleMutationResult & { id?: string }> {
  const name = input.name.trim().toLowerCase();
  const invalid = validateInput({ name, title: input.title });
  if (invalid) {
    return { ok: false, error: invalid };
  }
  const perms = normalizePermissions(input.permissions);
  if (!perms.ok) {
    return perms;
  }

  try {
    const role = await prisma.coreRole.create({
      data: { name, title: input.title.trim(), isAdmin: input.isAdmin, permissions: JSON.stringify(perms.permissions) },
    });
    return { ok: true, id: role.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'نقشی با این نام قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** ویرایش نقش — نقش سیستمی فقط عنوان؛ isAdmin نقش superadmin ثابت می‌ماند. */
export async function updateCoreRole(
  id: string,
  input: { title: string; isAdmin: boolean; permissions: unknown }
): Promise<CoreRoleMutationResult> {
  const role = await prisma.coreRole.findUnique({ where: { id } });
  if (!role) {
    return { ok: false, error: 'نقش یافت نشد.' };
  }

  const title = input.title.trim();
  if (title.length < 2 || title.length > 64) {
    return { ok: false, error: 'عنوان نقش باید ۲ تا ۶۴ نویسه باشد.' };
  }

  const isBuiltIn = (BUILTIN_CORE_ROLE_NAMES as readonly string[]).includes(role.name);
  let isAdmin = input.isAdmin;
  let permissions: string[];
  if (isBuiltIn) {
    // نقش‌های سیستمی هویتشان ثابت است — فقط عنوان قابل تغییر است.
    isAdmin = role.isAdmin;
    permissions = parsePermissions(role.permissions);
    if (role.isAdmin && !isAdmin) {
      return { ok: false, error: 'نقش «superadmin» باید دسترسی مدیر داشته باشد.' };
    }
  } else {
    const perms = normalizePermissions(input.permissions);
    if (!perms.ok) {
      return perms;
    }
    permissions = perms.permissions;
  }

  await prisma.coreRole.update({
    where: { id },
    data: { title, isAdmin, permissions: JSON.stringify(permissions) },
  });
  return { ok: true };
}

/** حذف نقش — نه سیستمی، نه در حال استفاده. */
export async function deleteCoreRole(id: string): Promise<CoreRoleMutationResult> {
  const role = await prisma.coreRole.findUnique({ where: { id } });
  if (!role) {
    return { ok: false, error: 'نقش یافت نشد.' };
  }
  if ((BUILTIN_CORE_ROLE_NAMES as readonly string[]).includes(role.name)) {
    return { ok: false, error: 'نقش‌های سیستمی (superadmin، support) حذف نمی‌شوند.' };
  }

  const holders = await prisma.coreUser.count({ where: { role: role.name } });
  if (holders > 0) {
    return {
      ok: false,
      error: `این نقش روی ${holders} کاربر تنظیم است — اول نقش کاربرانش را تغییر دهید.`,
    };
  }

  await prisma.coreRole.delete({ where: { id } });
  return { ok: true };
}
