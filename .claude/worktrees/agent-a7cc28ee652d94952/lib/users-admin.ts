/**
 * Admin-side user management (/users): listing every account, creating staff
 * or customer accounts, editing names/roles/credentials, and deleting — with
 * the last-admin and self-protection guards. Customers keep signing
 * themselves up through the storefront; this module is for the admin's
 * user/role administration only (requireApiAdmin-gated API routes).
 */

import { Prisma } from '@prisma/client';
import prisma from './db';
import { faNumber } from './format';
import { resolveUserRole } from './roles';
import { logSystemAudit } from './system-logs';
import { hashPassword, normalizePhone } from './users';

/**
 * Who is performing a mutation. The id drives the guards (never delete
 * yourself, never remove the last admin); the name lands in the system log,
 * because a row reading «آرش محمدی» answers "who did this?" on sight while a
 * cuid would send the reader on a second lookup.
 */
export interface AdminActor {
  id: string;
  name: string;
}

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
  /** Sign-in is refused while true (set from /users or /customers). */
  isBlocked: boolean;
  createdAt: string;
}

/** One line of the "why this account cannot be deleted" breakdown. */
export interface UserActivityLine {
  /** Persian label, e.g. 'سفارش'. */
  label: string;
  count: number;
}

export interface UserActivity {
  lines: UserActivityLine[];
  /** Sum of every line — 0 means the account left no trace at all. */
  total: number;
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
      isBlocked: true,
      createdAt: true,
    },
  });

  return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
}

/** The customer's display row on /users, fetched fresh for one id. */
export async function getAdminUser(id: string): Promise<AdminUserDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      loginMethod: true,
      walletBalance: true,
      isBlocked: true,
      createdAt: true,
    },
  });
  return user ? { ...user, createdAt: user.createdAt.toISOString() } : null;
}

/**
 * Everything this account left behind, counted per table.
 *
 * Deleting a user is only offered when *nothing* here is non-zero. The reason
 * is data integrity, not caution: `Order.userId` has no relation (seeded demo
 * rows have none), `Coupon.userId` is `onDelete: SetNull` — so a delete would
 * silently turn that customer's private coupons into public ones — and the
 * wallet/redemption rows are money history that must never lose its owner.
 *
 * Price changes carry no user id at all: `PriceChange.actorName` is
 * deliberately denormalised (the admin may later be renamed or removed), so the
 * only trace of a staff account's work is a name match.
 */
export async function getUserActivity(id: string): Promise<UserActivity | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!user) {
    return null;
  }

  const [
    orders,
    walletTransactions,
    onlinePayments,
    couponRedemptions,
    addresses,
    supportTickets,
    coupons,
    priceChanges,
  ] = await Promise.all([
    prisma.order.count({ where: { userId: id } }),
    prisma.walletTransaction.count({ where: { userId: id } }),
    prisma.onlinePaymentTransaction.count({ where: { userId: id } }),
    prisma.couponRedemption.count({ where: { userId: id } }),
    prisma.address.count({ where: { userId: id } }),
    prisma.supportTicket.count({ where: { userId: id } }),
    prisma.coupon.count({ where: { userId: id } }),
    prisma.priceChange.count({ where: { actorName: user.name } }),
  ]);

  const lines: UserActivityLine[] = [
    { label: 'سفارش', count: orders },
    { label: 'تراکنش کیف پول', count: walletTransactions },
    { label: 'پرداخت آنلاین', count: onlinePayments },
    { label: 'استفاده از کد تخفیف', count: couponRedemptions },
    { label: 'نشانی', count: addresses },
    { label: 'تیکت پشتیبانی', count: supportTickets },
    { label: 'کد تخفیف اختصاصی', count: coupons },
    { label: 'تغییر قیمت', count: priceChanges },
  ].filter((line) => line.count > 0);

  return { lines, total: lines.reduce((sum, line) => sum + line.count, 0) };
}

/** Blocks or unblocks any account (staff or customer) — sign-in is refused while blocked. */
export async function setUserBlocked(
  id: string,
  blocked: boolean,
  actor: AdminActor
): Promise<UserMutationResult> {
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  const result = await prisma.user.updateMany({ where: { id }, data: { isBlocked: blocked } });
  if (result.count === 0) {
    return { ok: false, error: 'کاربر یافت نشد.' };
  }
  await logSystemAudit({
    kind: 'user',
    action: 'block',
    actor: actor.name,
    message: `${user?.name ?? 'کاربر'} ${blocked ? 'غیرفعال شد.' : 'فعال شد.'}`,
    detail: blocked
      ? 'دسترسی این حساب به ورود بسته شد.'
      : 'این حساب دوباره می‌تواند وارد شود.',
  });
  return { ok: true };
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
export async function createAdminUser(
  input: {
    name: string;
    email: string | null;
    phone: string | null;
    password: string;
    role: string;
  },
  actor: AdminActor
): Promise<UserMutationResult & { id?: string }> {
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
    // The password is deliberately absent from the log — the log is readable
    // by every admin, and a credential would outlive the account it belongs to.
    await logSystemAudit({
      kind: 'user',
      action: 'create',
      actor: actor.name,
      message: `کاربر «${user.name}» ساخته شد.`,
      detail: [
        // The Persian title, not the machine name — the log is read by people,
        // and the update/delete rows for this same user already say «کارمند».
        `نقش: ${await roleTitle(input.role)}`,
        `شناسه ورود: ${validated.email ?? validated.phone ?? '—'}`,
      ].join('\n'),
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
 * Updates a user's profile, role and (optionally) password. `actor.id` powers
 * the last-admin guard: the target's admin access can only be removed while
 * another admin remains.
 */
export async function updateAdminUser(
  id: string,
  actor: AdminActor,
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

    // Only the fields that actually moved, so the log answers "what changed?"
    // rather than restating the whole form. A no-op save writes no row.
    const lines: string[] = [];
    const nextName = input.name.trim();
    if (user.name !== nextName) {
      lines.push(`نام: «${user.name}» به «${nextName}»`);
    }
    if (user.role !== input.role) {
      lines.push(`نقش: «${await roleTitle(user.role)}» به «${await roleTitle(input.role)}»`);
    }
    if (user.email !== validated.email) {
      lines.push(`ایمیل: ${user.email ?? '—'} به ${validated.email ?? '—'}`);
    }
    if (user.phone !== validated.phone) {
      lines.push(`موبایل: ${user.phone ?? '—'} به ${validated.phone ?? '—'}`);
    }
    if (input.password) {
      lines.push('گذرواژه بازنشانی شد — نشست‌های قبلی این کاربر معتبر می‌مانند.');
    }

    if (lines.length > 0) {
      const roleChanged = user.role !== input.role;
      await logSystemAudit({
        kind: 'user',
        action: roleChanged ? 'role' : 'update',
        actor: actor.name,
        message: roleChanged
          ? `نقش کاربر «${nextName}» تغییر کرد.`
          : `کاربر «${nextName}» ویرایش شد.`,
        detail: lines.join('\n'),
      });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'کاربری با این ایمیل یا شماره موبایل قبلاً ثبت شده است.' };
    }
    throw error;
  }
}

/** A role machine name as its Persian title, falling back to the raw name. */
async function roleTitle(name: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { name }, select: { title: true } });
  return role?.title ?? name;
}

/** Users whose effective access is admin, excluding the given user id. */
async function countOtherAdmins(excludeUserId: string): Promise<number> {
  const roles = await prisma.role.findMany({ where: { isAdmin: true }, select: { name: true } });
  const adminNames = ['admin', ...roles.map((role) => role.name)];
  return prisma.user.count({
    where: { id: { not: excludeUserId }, role: { in: adminNames } },
  });
}

/** Deletes a user — never yourself, never the last admin, never with activity. */
export async function deleteAdminUser(id: string, actor: AdminActor): Promise<UserMutationResult> {
  if (id === actor.id) {
    return { ok: false, error: 'حساب خودتان را نمی‌توانید حذف کنید.' };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { ok: false, error: 'کاربر یافت نشد.' };
  }

  // A user with any recorded activity is only ever deactivated: the rows that
  // reference them (orders, wallet ledger, redemptions) must keep their owner.
  const activity = await getUserActivity(id);
  if (activity && activity.total > 0) {
    const breakdown = activity.lines
      .map((line) => `${line.label}: ${faNumber(line.count)}`)
      .join('، ');
    return {
      ok: false,
      error: `این کاربر ${faNumber(activity.total)} مورد فعالیت ثبت‌شده دارد (${breakdown}) و حذف نمی‌شود — فقط می‌توانید غیرفعالش کنید.`,
    };
  }

  if ((await resolveUserRole(user.role)) === 'admin') {
    const otherAdmins = await countOtherAdmins(id);
    if (otherAdmins === 0) {
      return { ok: false, error: 'حداقل یک مدیر باید در سایت بماند — این کاربر حذف نشد.' };
    }
  }

  await prisma.user.delete({ where: { id } });
  await logSystemAudit({
    kind: 'user',
    action: 'delete',
    actor: actor.name,
    message: `کاربر «${user.name}» حذف شد.`,
    detail: `نقش: ${await roleTitle(user.role)}`,
  });
  return { ok: true };
}
