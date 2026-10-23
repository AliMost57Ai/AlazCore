/**
 * Admin-side user management (/users): listing every account, creating staff
 * or customer accounts, editing names/roles/credentials, and deleting — with
 * the last-admin and self-protection guards. Customers keep signing
 * themselves up through the storefront; this module is for the admin's
 * user/role administration only (requireApiAdmin-gated API routes).
 */

import { Prisma } from './generated/prisma/client';
import prisma from './db';
import { resolveUserRole } from './roles';
import { hashPassword, normalizePhone } from './users';

/** One admin-listed user row. */
export interface AdminUserDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** The raw Role machine name stored on the row (not the session role). */
  role: string;
  loginMethod: string;
  walletBalance: number;
  createdAt: string;
}

export type UserMutationResult = { ok: true } | { ok: false; error: string };

/**
 * All staff accounts (newest first), optionally filtered by a free-text
 * search. Customers are deliberately absent — they live on /customers.
 */
export async function listAdminUsers(search?: string): Promise<AdminUserDTO[]> {
  const q = search?.trim();
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'customer' },
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q.replace(/\D/g, '') || q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      loginMethod: true,
      walletBalance: true,
      createdAt: true,
    },
  });

  return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
}

/** Normalises + validates the shared identifier fields. */
async function validateIdentifiers(input: {
  name: string;
  email: string | null;
  phone: string | null;
  password: string | null;
  role: string;
}): Promise<
  { ok: true; email: string | null; phone: string | null } | { ok: false; error: string }
> {
  if (input.name.trim().length < 2) {
    return { ok: false, error: 'نام باید حداقل ۲ نویسه باشد.' };
  }
  if (!input.email && !input.phone) {
    return { ok: false, error: 'ایمیل یا شماره موبایل لازم است — کاربر باید بتواند وارد شود.' };
  }

  const email = input.email ? input.email.trim().toLowerCase() : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (input.email && !email) {
    return { ok: false, error: 'ایمیل نامعتبر است.' };
  }
  if (input.phone && !phone) {
    return { ok: false, error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' };
  }
  if (input.password !== null && input.password.length < 8) {
    return { ok: false, error: 'گذرواژه باید حداقل ۸ نویسه باشد.' };
  }

  if (input.role === 'customer') {
    return { ok: false, error: 'مشتریان از صفحه مشتریان مدیریت می‌شوند.' };
  }
  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) {
    return { ok: false, error: 'نقش انتخابی یافت نشد.' };
  }

  return { ok: true, email, phone };
}

/** Creates a user (staff or customer) with a fresh salted password hash. */
export async function createAdminUser(input: {
  name: string;
  email: string | null;
  phone: string | null;
  password: string;
  role: string;
}): Promise<UserMutationResult & { id?: string }> {
  const validated = await validateIdentifiers(input);
  if (!validated.ok) {
    return validated;
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'گذرواژه باید حداقل ۸ نویسه باشد.' };
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password, salt);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: validated.email,
        phone: validated.phone,
        role: input.role,
        salt,
        passwordHash,
      },
    });
    return { ok: true, id: user.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'کاربری با این ایمیل یا شماره موبایل قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/**
 * Updates a user's profile, role and (optionally) password. `actorId` powers
 * the last-admin guard: the target's admin access can only be removed while
 * another admin remains.
 */
export async function updateAdminUser(
  id: string,
  _actorId: string,
  input: {
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    password: string | null;
  }
): Promise<UserMutationResult> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { ok: false, error: 'کاربر یافت نشد.' };
  }

  const validated = await validateIdentifiers({ ...input, password: input.password });
  if (!validated.ok) {
    return validated;
  }

  // Last-admin guard: leaving this user non-admin must keep another admin.
  if ((await resolveUserRole(user.role)) === 'admin') {
    const nextAdmin = await prisma.role.findUnique({
      where: { name: input.role },
      select: { isAdmin: true },
    });
    if (nextAdmin?.isAdmin !== true) {
      const otherAdmins = await countOtherAdmins(id);
      if (otherAdmins === 0) {
        return { ok: false, error: 'حداقل یک مدیر باید در سایت بماند — نقش این کاربر عوض نشد.' };
      }
    }
  }

  const data: Prisma.UserUpdateInput = {
    name: input.name.trim(),
    email: validated.email,
    phone: validated.phone,
    role: input.role,
  };
  if (input.password) {
    const salt = crypto.randomUUID();
    data.salt = salt;
    data.passwordHash = await hashPassword(input.password, salt);
  }

  try {
    await prisma.user.update({ where: { id }, data });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'کاربری با این ایمیل یا شماره موبایل قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** Users whose effective access is admin, excluding the given user id. */
async function countOtherAdmins(excludeUserId: string): Promise<number> {
  const roles = await prisma.role.findMany({ where: { isAdmin: true }, select: { name: true } });
  const adminNames = ['admin', ...roles.map((role) => role.name)];
  return prisma.user.count({
    where: { id: { not: excludeUserId }, role: { in: adminNames } },
  });
}

/** Deletes a user — never yourself, never the last admin. */
export async function deleteAdminUser(id: string, actorId: string): Promise<UserMutationResult> {
  if (id === actorId) {
    return { ok: false, error: 'حساب خودتان را نمی‌توانید حذف کنید.' };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { ok: false, error: 'کاربر یافت نشد.' };
  }

  if ((await resolveUserRole(user.role)) === 'admin') {
    const otherAdmins = await countOtherAdmins(id);
    if (otherAdmins === 0) {
      return { ok: false, error: 'حداقل یک مدیر باید در سایت بماند — این کاربر حذف نشد.' };
    }
  }

  await prisma.user.delete({ where: { id } });
  return { ok: true };
}
