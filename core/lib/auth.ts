/**
 * احراز هویت کاربران پنل Core — ورود با ایمیل + رمز (PBKDF2-SHA256،
 * ۱۰۰هزار دور، salt اختصاصی هر کاربر — همان قالب فروشگاه).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import prisma from './db';
import { hasCoreCapability, hasCorePermission, type MenuAction } from './nav-permissions';
import { SESSION_COOKIE, verifySession, type CoreSessionPayload } from './session';

export { SESSION_COOKIE };
export type { CoreSessionPayload };

export interface CoreStoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  salt: string;
  passwordHash: string;
  isActive: boolean;
}

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
}

export function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<Omit<CoreStoredUser, 'salt' | 'passwordHash'> | null> {
  const user = await prisma.coreUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) {
    return null;
  }
  const candidate = hashPassword(password, user.salt);
  if (!safeEqual(candidate, user.passwordHash)) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

/** The authoritative in-page session guard — a cookie merely existing is not enough. */
export async function requireSession(): Promise<CoreSessionPayload> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function getSession(): Promise<CoreSessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** API guard — returns the session, or a NextResponse 401/403 the route returns. */
export async function requireApiSession(): Promise<CoreSessionPayload | Response> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return Response.json({ error: 'ابتدا وارد شوید.' }, { status: 401 });
  }
  return session;
}

/**
 * نقشِ کاربر Core از روی نام ماشین نقش resolve می‌شود — هم‌سان
 * resolveUserRole فروشگاه. نقش‌های isAdmin دسترسی کامل پنل دارند.
 */
export async function resolveCoreRole(roleName: string): Promise<{
  isAdmin: boolean;
  permissions: string[];
} | null> {
  if (roleName === 'superadmin') {
    return { isAdmin: true, permissions: ['*'] };
  }
  const role = await prisma.coreRole.findUnique({ where: { name: roleName } });
  if (!role) {
    return null;
  }
  if (role.isAdmin) {
    return { isAdmin: true, permissions: ['*'] };
  }
  try {
    const parsed = JSON.parse(role.permissions);
    return {
      isAdmin: false,
      permissions: Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return { isAdmin: false, permissions: [] };
  }
}

/** API گارد مشاهده/نوشتن روی یک منوی پنل Core — هم‌سان requireApiMenu فروشگاه. */
export async function requireApiMenu(
  menu: string,
  action: MenuAction | MenuAction[] = 'view'
): Promise<CoreSessionPayload | Response> {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }
  const resolved = await resolveCoreRole(session.role);
  if (resolved?.isAdmin) {
    return session;
  }
  const actions = Array.isArray(action) ? action : [action];
  const allowed = actions.some((one) => hasCorePermission(resolved?.permissions ?? [], menu, one));
  return allowed ? session : Response.json({ error: 'دسترسی به این بخش ندارید.' }, { status: 403 });
}

/** گارد مدیریتی: فقط نقش‌های isAdmin (کاربران/نقش‌ها/تنظیمات). */
export async function requireApiAdmin(): Promise<CoreSessionPayload | Response> {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }
  const resolved = await resolveCoreRole(session.role);
  return resolved?.isAdmin
    ? session
    : Response.json({ error: 'این عملیات فقط برای مدیر سامانه مجاز است.' }, { status: 403 });
}

/**
 * آیا این نشست حق فعال/غیرفعال کردن خالی‌فروشی دامنه و تعیین سقف آن را دارد؟
 * زنجیره مجوز تسک «خالی‌فروشی»: مدیر کل همیشه؛ کارشناس دامنه فقط با قابلیت
 * 'cap:domain-oversell' که در نقش‌های پنل به او واگذار شده باشد.
 */
export async function canOversellDomain(session: CoreSessionPayload): Promise<boolean> {
  const resolved = await resolveCoreRole(session.role);
  if (resolved?.isAdmin) {
    return true;
  }
  return hasCoreCapability(resolved?.permissions ?? [], 'cap:domain-oversell');
}
